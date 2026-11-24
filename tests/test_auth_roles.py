from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.roles import UserRole
from app.core.security import hash_password
from app.database import Base, get_db
from app.main import app
from app.models.contact import Contact
from app.models.user import User


@pytest.fixture
def client() -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client, testing_session
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def add_account(
    session_factory: sessionmaker[Session],
    email: str,
    role: UserRole,
    password: str = "TestPass123!",
) -> User:
    with session_factory() as db:
        contact = Contact(name=email.split("@")[0], phone="555-0100", address="Test")
        db.add(contact)
        db.flush()
        user = User(
            email=email,
            password=hash_password(password),
            role=role.value,
            is_active=True,
            contact_id=contact.id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def sign_in(client: TestClient, email: str, password: str = "TestPass123!"):
    return client.post("/login", json={"email": email, "password": password})


def test_public_registration_login_protection_and_logout(client):
    api, _ = client
    assert api.get("/products/").status_code == 200
    assert api.get("/categories/").status_code == 200
    assert api.get("/auth/me").status_code == 401
    assert api.get("/users/").status_code == 401
    assert sign_in(api, "missing@example.com").status_code == 401

    registered = api.post(
        "/register",
        json={
            "name": "Public User",
            "phone": "555-0101",
            "address": "Test address",
            "email": "public@example.com",
            "password": "TestPass123!",
        },
    )
    assert registered.status_code == 201
    assert registered.json()["role"] == UserRole.USER.value

    login = sign_in(api, "public@example.com")
    assert login.status_code == 200
    assert "httponly" in login.headers["set-cookie"].lower()
    assert api.get("/auth/me").json()["role"] == UserRole.USER.value
    profile = api.patch(
        "/auth/profile",
        json={
            "name": "Updated Public User",
            "email": "updated@example.com",
            "phone": "555-0199",
            "address": "New address",
            "role": "admin",
        },
    )
    assert profile.status_code == 200
    assert profile.json()["profile"]["name"] == "Updated Public User"
    assert profile.json()["role"] == UserRole.USER.value
    assert api.get("/auth/me").json()["email"] == "updated@example.com"
    assert api.get("/manager/profile").status_code == 403
    assert api.get("/customers/").status_code == 403
    assert api.post("/categories/", json={"name": "Blocked", "description": None}).status_code == 403

    assert api.post("/logout").status_code == 200
    assert api.get("/auth/me").status_code == 401


def test_admin_manages_roles_and_account_status(client):
    api, session_factory = client
    admin = add_account(session_factory, "admin@example.com", UserRole.ADMIN)
    assert sign_in(api, "admin@example.com").status_code == 200
    assert api.get("/admin/profile").status_code == 200
    assert api.patch(f"/users/{admin.id}/status", json={"is_active": False}).status_code == 400
    assert api.patch(f"/users/{admin.id}/role", json={"role": "staff"}).status_code == 400
    assert api.delete(f"/users/{admin.id}").status_code == 400

    category = api.post("/categories/", json={"name": "Test category", "description": None})
    assert category.status_code == 201
    product = api.post(
        "/products/",
        json={
            "category_id": category.json()["id"],
            "sku": "TEST-001",
            "name": "Test product",
            "description": None,
            "unit_price": "12.50",
            "reorder_level": 3,
        },
    )
    assert product.status_code == 201
    warehouse = api.post("/warehouses/", json={"name": "Test warehouse", "location": "Test"})
    assert warehouse.status_code == 201
    stock = api.post(
        "/stocks/",
        json={"warehouse_id": warehouse.json()["id"], "product_id": product.json()["id"]},
    )
    assert stock.status_code == 201

    created = api.post(
        "/users/",
        json={
            "name": "Manager One",
            "phone": "555-0110",
            "address": "Test address",
            "email": "manager@example.com",
            "password": "ManagerPass123!",
            "role": "manager",
        },
    )
    assert created.status_code == 201
    manager_id = created.json()["id"]
    assert created.json()["role"] == "manager"

    staff = api.post(
        "/users/",
        json={
            "name": "Staff One",
            "phone": "555-0111",
            "address": "Test address",
            "email": "staff@example.com",
            "password": "StaffPass123!",
            "role": "staff",
        },
    )
    assert staff.status_code == 201

    manager_client = TestClient(app)
    assert sign_in(manager_client, "manager@example.com", "ManagerPass123!").status_code == 200
    assert manager_client.get("/manager/profile").status_code == 200
    assert manager_client.get("/admin/profile").status_code == 403
    assert "total_stock" in manager_client.get(f"/products/{product.json()['id']}").json()

    status_update = api.patch(f"/users/{manager_id}/status", json={"is_active": False})
    assert status_update.status_code == 200
    assert sign_in(TestClient(app), "manager@example.com", "ManagerPass123!").status_code == 403

    assert api.patch(f"/users/{manager_id}/status", json={"is_active": True}).status_code == 200
    assert manager_client.get("/auth/me").status_code == 200
    assert manager_client.post("/logout").status_code == 200
    assert manager_client.get("/auth/me").status_code == 401

    staff_client = TestClient(app)
    assert sign_in(staff_client, "staff@example.com", "StaffPass123!").status_code == 200
    assert staff_client.get("/staff/profile").status_code == 200
    assert staff_client.get("/admin/profile").status_code == 403

    registered = api.post(
        "/register",
        json={
            "name": "Promoted User",
            "phone": "555-0112",
            "address": "Test",
            "email": "promoted@example.com",
            "password": "PromotedPass123!",
        },
    )
    promoted_id = registered.json()["user_id"]
    public_client = TestClient(app)
    assert "total_stock" not in public_client.get(f"/products/{product.json()['id']}").json()
    assert api.patch(f"/users/{promoted_id}/role", json={"role": "staff"}).json()["role"] == "staff"
    promoted_client = TestClient(app)
    assert sign_in(promoted_client, "promoted@example.com", "PromotedPass123!").status_code == 200
    assert promoted_client.get("/staff/profile").status_code == 200
    assert "total_stock" in promoted_client.get(f"/products/{product.json()['id']}").json()

    assert api.delete(f"/users/{staff.json()['id']}").status_code == 200
