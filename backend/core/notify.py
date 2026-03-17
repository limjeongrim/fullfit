from sqlalchemy.orm import Session
from backend.models.notification import Notification, NotificationType


def create_notification(
    db: Session,
    user_id: int,
    ntype: NotificationType,
    title: str,
    message: str,
) -> None:
    """Add a notification record. Caller must commit the session."""
    n = Notification(user_id=user_id, type=ntype, title=title, message=message)
    db.add(n)
