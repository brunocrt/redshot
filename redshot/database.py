"""
Simple local database for recording trade executions.

This module provides helper functions and an ORM class to store executed trades
in an SQLite database.  SQLite is a small, fast, self‑contained SQL database
engine that is widely used and available in the public domain【969406860611009†L51-L65】.
Using a local SQLite file allows the system to persist trade history for
accounting and reporting without the overhead of running a separate database
server.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List

from sqlalchemy import Column, DateTime, Float, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os

from .entities import Trade


LOGGER = logging.getLogger(__name__)

# Define the ORM base
Base = declarative_base()


class TradeRecord(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True)
    exchange = Column(String, nullable=False)
    asset_code = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    side = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "exchange": self.exchange,
            "asset_code": self.asset_code,
            "price": self.price,
            "quantity": self.quantity,
            "side": self.side,
            "timestamp": self.timestamp.isoformat(),
        }


# Create a database engine and session factory.  Persist trades in the
# `data` directory so that it can be easily mapped to a Docker volume.  The
# default path can be overridden via the ``DATABASE_URL`` environment
# variable.  If running in Docker, mount a host directory to ``/app/data`` to
# preserve trades across container restarts.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/trades.db")
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


def init_db() -> None:
    """Create database tables if they do not exist."""
    Base.metadata.create_all(bind=engine)
    LOGGER.info("Database initialised at %s", DATABASE_URL)


def add_trade(trade: Trade) -> None:
    """
    Persist a trade in the database.

    :param trade: the trade to persist
    """
    session = SessionLocal()
    try:
        record = TradeRecord(
            exchange=trade.exchange.name,
            asset_code=trade.asset.code,
            price=trade.price,
            quantity=trade.quantity,
            # Use the side attribute of the Trade dataclass.  This allows
            # accurate recording of buy/sell semantics regardless of quantity sign.
            side=trade.side,
            timestamp=trade.date,
        )
        session.add(record)
        session.commit()
        LOGGER.info("Recorded trade %s", record.to_dict())
    except Exception as exc:
        LOGGER.error("Failed to record trade: %s", exc)
        session.rollback()
    finally:
        session.close()


def get_all_trades() -> List[dict]:
    """
    Retrieve all trades from the database as a list of dicts.
    """
    session = SessionLocal()
    try:
        trades = session.query(TradeRecord).order_by(TradeRecord.timestamp.desc()).all()
        return [t.to_dict() for t in trades]
    finally:
        session.close()
