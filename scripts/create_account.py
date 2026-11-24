"""Create or repair a local Dream Warehouse account with an operational role."""

from getpass import getpass
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.roles import UserRole
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.contact import Contact
from app.models.user import User


ROLES = {
    "1": UserRole.ADMIN.value,
    "2": UserRole.MANAGER.value,
    "3": UserRole.STAFF.value,
}


def main() -> None:
    print("Dream Warehouse account setup")
    print("Creates a new account or updates the role/password for an existing email.\n")
    print("Choose role: 1) admin  2) manager  3) staff")
    role_choice = input("Role [1/2/3]: ").strip()
    role = ROLES.get(role_choice)
    if not role:
        print("Choose 1, 2, or 3.")
        return

    email = input("Email: ").strip().lower()
    if "@" not in email:
        print("Enter a valid email address.")
        return

    name = input("Name: ").strip() or email.split("@", 1)[0]
    phone = input("Phone (optional): ").strip() or "Not provided"
    address = input("Address (optional): ").strip() or "Not provided"
    password = getpass("Password: ")
    if not password:
        print("Password cannot be empty.")
        return
    if password != getpass("Confirm password: "):
        print("Passwords do not match.")
        return

    if input(f"Save {role} account for {email}? [y/N]: ").strip().lower() != "y":
        print("Cancelled.")
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            contact = db.query(Contact).filter(Contact.id == user.contact_id).first()
            if contact is None:
                contact = Contact(name=name, phone=phone, address=address)
                db.add(contact)
                db.flush()
                user.contact_id = contact.id
            else:
                contact.name = name
                contact.phone = phone
                contact.address = address
            user.role = role
            user.password = hash_password(password)
            user.is_active = True
            message = "Account updated"
        else:
            contact = Contact(name=name, phone=phone, address=address)
            db.add(contact)
            db.flush()
            user = User(
                email=email,
                password=hash_password(password),
                role=role,
                contact_id=contact.id,
                is_active=True,
            )
            db.add(user)
            message = "Account created"

        db.commit()
        print(f"{message}: {email} ({role}). You can now sign in at http://localhost:3000/login")
    except Exception:
        db.rollback()
        print("Could not save account. Check that PostgreSQL is running and the project database settings are correct.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
