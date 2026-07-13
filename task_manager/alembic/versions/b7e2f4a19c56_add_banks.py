"""add_banks

Revision ID: b7e2f4a19c56
Revises: a1c4f9e07b23
Create Date: 2026-07-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e2f4a19c56'
down_revision: Union[str, None] = 'a1c4f9e07b23'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED_BANKS = [
    "510 Army Base W/S Credit Co-Op. Primary Bank Ltd",
    "Adarsh Mahila Mercantile Co-Operative Bank Ltd.",
    "Allahabad Bank Em Thrift & Credit Coop Society Ltd",
    "Bally Co-Operative Bank Ltd",
    "The Bankura Town Co-Operative Bank Ltd.",
    "Basic Shikshak Vetan Bhogi Karamchari Sah. Sam. Ltd",
    "Bhadohi Urban Co-Operative Bank Ltd.",
    "Bhind Nagrik Sahkari Bank Ltd",
    "The Bihar Awami Co-Operative Bank Ltd.",
    "Brahmawart Commercial Co-Op. Bank Ltd",
    "Citizen Co-operative Bank Ltd.",
    "The Citizen Co-operative Bank Ltd. (Delhi)",
    "Citizens Urban Coop Bank Ltd (Sikkim)",
    "Dayalbagh Mahila Co-Operative Bank Ltd.",
    "Delhi Nagrik Sehkari Bank Ltd",
    "Development Co-Operative Bank Ltd.",
    "Devika Urban Co-Operative Bank Ltd.",
    "Etah Urban Co-Operative Bank Ltd.",
    "Etawah Nagar Sahkari Bank Ltd",
    "Etawah Urban Co-Operative Bank Ltd.",
    "Future Finvest Company Pvt Ltd",
    "The Ganga Mercantile Co-Operative Bank Ltd.",
    "Global Thrift & Credit Co-Operative Society Ltd.",
    "Gomti Nagariya Sahakari Bank Ltd",
    "Gramin Bachat Bank",
    "Hissar Urban Co-Operative Bank Ltd.",
    "Imperial Urban Co-Operative Bank Ltd (Faizabad)",
    "The Imphal Urban Co-Operative Bank Ltd.",
    "Indian Mercantile Co-Operative Bank Ltd.",
    "Indraprastha Sehkari Bank Ltd.",
    "Innovative Urban Co-Operative Bank Ltd",
    "JAIN Co-Operative Bank Ltd",
    "Jamshedpur Urban Co-Operative Bank Ltd",
    "The Janata Co-Operative Bank Ltd.",
    "The Karan Urban Co-Operative Bank Ltd.",
    "Keshav Sehkari Bank Ltd.",
    "Khalilabad Nagar Sahkari Bank Ltd.",
    "The Khattri Co-Operative (U) Bank Ltd.",
    "The Koylanchal Urban Co Operative Bank Ltd",
    "Krishnanagar City Co-Operative Bank Ltd.",
    "Laxmibai Mahila Nagar Sahakari Bank Maryadit",
    "Lucknow University Primary Co-operative Bank Ltd",
    "Mahayaan Urban Co-Op Credit & Thrift Society Ltd.",
    "Mahoba Urban Co-Operative Bank Ltd",
    "Mainpuri Urban Cooperative Bank Ltd",
    "The Mechanical Department Primary Cooperative Bank Limited NE Railway",
    "Mercantile Co-Operative Bank Ltd (Banaras)",
    "Moirang Primary Co-Operative Bank Ltd.",
    "The N.E. & E.C. Railway Employee's Multi State Primary Co-operative Bank Ltd.",
    "The Nabadwip Co-Operative Bank Ltd.",
    "Nagar Sahkari Bank Ltd. (Gorakhpur)",
    "Nagrik Sahakari Bank Ltd Raipur",
    "Nagrik Sahkari Bank Ltd. (Lucknow)",
    "Nagrik Sahkari Bank Maryadit (Rajgarh)",
    "Nagrik Sahkari Bank Maryadit - Jagdalpur",
    "National Mercantile Co-operative Bank Ltd.",
    "National Urban Co-Operative Bank Ltd (Pratapgarh)",
    "National Urban Co-Operative Bank Ltd.",
    "The New Agra Urban Co-Operative Bank Ltd",
    "Noida Commercial Co-Operative Bank Ltd.",
    "Northen Railway Multi State Primary Co-Operative Bank Ltd.",
    "Northern Railway Primary CO OP Bank Ltd Staff PF Trust",
    "Omkar Nagreeya Sahkari Bank Ltd.",
    "Ordnance Equipment Factory Prarmbhik Sahkari Bank Ltd.",
    "Progressive Urban Co-Operative Bank Ltd.",
    "The Radhasoami Urban Co-Operative Bank Ltd.",
    "Railway Shramik Shakari Bank Ltd.",
    "The Rajasthan Urban Co-Operative Bank Ltd",
    "Rajdhani Nagar Sahkari Bank Ltd.",
    "Ramgarhia Co-Operative Bank Ltd.",
    "Ranaghat People's Co-Operative Bank Ltd.",
    "Rani Laxmi Bai Urban Co-Operative Bank Ltd.",
    "RBI Employees Credit Co.Op. Society Ltd. (Patna)",
    "Reserv Bank of India Employee's Co-Operative Credit Bank Ltd. (Kanpur)",
    "Sadbhav Nagrik Sahakari Bank Mydt.",
    "Shimla Urban Co-Operative Bank Ltd.",
    "Siddhartha Nagar Urban Co Operative Bank Ltd.",
    "Sonebhadra Nagar Sahkari Bank Ltd.",
    "Sree Chaitanya Co-Operative Bank Ltd",
    "The Tapindu Urban Co-Operative Bank Ltd.",
    "Ujjain Udyagik Nagrik Sahkari Bank Maryadit",
    "United Mercantile Co-Operative Bank Ltd. (Kanpur)",
    "UP Civil Sectt. Primary Co Operative Bank Limited",
    "UP Postal Primary Co-operative Bank Ltd.",
    "UP Postal Primary Co-Operative Bank Ltd. CPF Trust",
    "Urban Co Operative Bank Ltd. (Mau)",
    "Urban Co-Operative Bank Ltd (Budaun)",
    "Urban Co-operative Bank Ltd. Saharanpur",
    "Urban Cooperative Bank Ltd Basti",
    "Uttrakhand Co Operative Bank Ltd",
    "The Vaish Co-Operative Adarsh Bank Ltd.",
    "The Vaish Co-Operative New Bank Ltd.",
    "Vayasaiek Evam Audhyogik Sahkari Bank Ltd.",
    "Vivekanand Nagrik Sahkari Bank Ltd",
]


def upgrade() -> None:
    banks_table = op.create_table(
        'banks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        'task_banks',
        sa.Column('task_id', sa.Integer(), sa.ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('bank_id', sa.Integer(), sa.ForeignKey('banks.id', ondelete='CASCADE'), primary_key=True),
    )

    # Seed banks
    op.bulk_insert(banks_table, [{'name': name} for name in SEED_BANKS])


def downgrade() -> None:
    op.drop_table('task_banks')
    op.drop_table('banks')
