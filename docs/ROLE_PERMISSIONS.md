# Role permissions

This is the access policy implemented by the API. The API is the security boundary; frontend route guards and hidden actions mirror it for usability.

| Area | Guest and `user` | `staff` | `manager` | `admin` |
| --- | --- | --- | --- | --- |
| Home, login, registration | View home; register as `user`; login | Same login | Same login | Same login |
| Product catalog | Read product list and basic product details | Read catalog and operational stock detail | Same | Same |
| Categories | Read list, detail, and category products | Same | Same | Same |
| Product/category writes | None | None | Create and update | Create, update, delete |
| Dashboard | None | Staff dashboard | Manager dashboard | Admin dashboard |
| Customers | None | Read/create; update own records | Read/create/update | Full access, including delete |
| Suppliers | None | None | Read/create/update | Full access, including delete |
| Purchases and purchase items | None | None | Read/create/update | Full access, including delete |
| Sales orders | None | Read/create/update | Read/create/update | Full access, including delete |
| Sales order items | None | None | Read/create/update | Full access, including delete |
| Warehouses | None | Read | Read/update | Full access, including create/delete |
| Stock records and alerts | None | Read | Read/update (direct quantity updates return 405) | Full access; direct quantity updates return 405 |
| Stock activities and reports | None | Read reports and activity history | Same | Full access, including create/update/delete |
| Shipments | None | Read and update shipment status | Read/create/update/status | Full access, including delete |
| Invoices and transactions | None | None | Read | Full access |
| Contacts | None | Read/create/update | Read/create/update | Full access, including delete |
| Stock adjustment requests | None | Submit and view own requests | View requests | View, approve, and reject requests |
| User and role management | None | None | None | `/users` page/API: list/create/update/delete users, assign roles, activate/deactivate accounts |
| API test utility | None | None | None | Open `/api-test` |

Notes:

- Public registration never accepts a role from the request; new registrations always receive `user`.
- Admin-created accounts and role changes are admin-only. The initial admin is provisioned with `scripts/create_account.py`.
- Public product detail responses omit stock quantities and warehouse details. Those fields are returned only to active staff, manager, or admin accounts.
- Frontend page guards do not replace API checks. Every protected API operation must retain its own role dependency.
- `GET /products/`, `GET /products/{id}`, category reads, and category product reads are public. Stock, customers, suppliers, orders, users, and other operational APIs require an allowed role.
