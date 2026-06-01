"""Tests for changes to app/models/user.py and app/enums/shipment.py in this PR.

user.py: User is now an alias for Customer (backward-compat shim).
shipment.py: ShipmentStatus was removed; ShipmentMethod remains.
"""

# ---------------------------------------------------------------------------
# User = Customer alias
# ---------------------------------------------------------------------------


def test_user_is_customer_alias():
    from app.models.user import User
    from app.models.customer import Customer

    assert User is Customer


def test_user_and_customer_share_tablename():
    from app.models.user import User
    from app.models.customer import Customer

    assert User.__tablename__ == Customer.__tablename__ == "customer"


def test_user_module_exports_both_names():
    import app.models.user as user_module

    assert hasattr(user_module, "User")
    assert hasattr(user_module, "Customer")


def test_user_alias_is_same_class_not_copy():
    """User and Customer must be identical objects (not subclasses)."""
    from app.models.user import User
    from app.models.customer import Customer

    assert User is Customer


# ---------------------------------------------------------------------------
# ShipmentMethod enum (retained)
# ---------------------------------------------------------------------------


def test_shipment_method_store_pickup():
    from app.enums.shipment import ShipmentMethod

    assert ShipmentMethod.STORE_PICKUP == "STORE_PICKUP"


def test_shipment_method_delivery():
    from app.enums.shipment import ShipmentMethod

    assert ShipmentMethod.DELIVERY == "DELIVERY"


def test_shipment_method_only_two_members():
    from app.enums.shipment import ShipmentMethod

    members = {m.name for m in ShipmentMethod}
    assert members == {"STORE_PICKUP", "DELIVERY"}


# ---------------------------------------------------------------------------
# ShipmentStatus was removed (no longer importable)
# ---------------------------------------------------------------------------


def test_shipment_status_no_longer_importable():
    """ShipmentStatus was deleted in this PR and must not be importable."""
    import app.enums.shipment as shipment_module

    assert not hasattr(shipment_module, "ShipmentStatus")


def test_enums_init_does_not_export_staff_role():
    """StaffRole (from deleted user.py) must not appear in the enums package."""
    import app.enums as enums_pkg

    assert not hasattr(enums_pkg, "StaffRole")
