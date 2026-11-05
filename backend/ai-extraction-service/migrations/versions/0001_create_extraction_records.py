"""create extraction_records

Revision ID: 0001
Revises:
Create Date: 2026-11-03
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "extraction_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("document_id", sa.Uuid(), nullable=False),
        sa.Column("document_checksum", sa.String(64), nullable=False),
        sa.Column("document_type", sa.String(50)),
        sa.Column("quotation_id", sa.Uuid()),
        sa.Column("vendor_id", sa.Uuid()),
        sa.Column("procurement_request_id", sa.Uuid()),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("superseded", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("document_format", sa.String(20)),
        sa.Column("used_ocr", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("overall_confidence", sa.Numeric(4, 3)),
        sa.Column("requires_human_review", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("result", postgresql.JSONB()),
        sa.Column("issues", postgresql.JSONB()),
        sa.Column("failure_code", sa.String(50)),
        sa.Column("failure_reason", sa.Text()),
        sa.Column("correlation_id", sa.String(64)),
        sa.Column("requested_by", sa.Uuid()),
        sa.Column("llm_provider", sa.String(30)),
        sa.Column("llm_model", sa.String(100)),
        sa.Column("prompt_version", sa.String(50)),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processing_ms", sa.Integer()),
        sa.Column("event_published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint(
            "status IN ('PENDING','PROCESSING','COMPLETED','NEEDS_REVIEW','FAILED')", name="ck_extraction_status"),
        sa.CheckConstraint(
            "overall_confidence IS NULL OR (overall_confidence >= 0 AND overall_confidence <= 1)",
            name="ck_extraction_confidence"),
    )
    op.create_index("ix_extraction_records_document_id", "extraction_records", ["document_id"])
    op.create_index("ix_extraction_records_quotation_id", "extraction_records", ["quotation_id"])
    op.create_index("ix_extraction_records_status", "extraction_records", ["status"])
    op.create_index(
        "uq_extraction_active_document", "extraction_records", ["document_id", "document_checksum"],
        unique=True, postgresql_where=sa.text("status <> 'FAILED' AND superseded = false"))


def downgrade() -> None:
    op.drop_table("extraction_records")
