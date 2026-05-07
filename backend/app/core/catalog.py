from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Department

DEPARTMENT_NAMES = [
    "Agriculture Department",
    "Animal Husbandry & Dairying",
    "Civil Aviation",
    "Coal Ministry",
    "Commerce & Industry",
    "Consumer Affairs",
    "Cooperation",
    "Culture Department",
    "Defence Department",
    "Disaster Management",
    "Education Department",
    "Election Commission",
    "Environment & Climate",
    "Finance Department",
    "Fisheries Department",
    "Food & Public Distribution",
    "Forest Department",
    "General Administration",
    "Health & Family Welfare",
    "Higher Education",
    "Home Department",
    "Horticulture Department",
    "Housing & Urban Affairs",
    "Information & Broadcasting",
    "Irrigation Department",
    "IT & Electronics",
    "Jal Shakti / Water Resources",
    "Labour & Employment",
    "Law Department",
    "Micro, Small & Medium Enterprises",
    "Mines Department",
    "New & Renewable Energy",
    "Personnel & Training",
    "Petroleum & Natural Gas",
    "Planning & Statistics",
    "Ports, Shipping & Waterways",
    "Power Department",
    "Public Works Department",
    "Railways",
    "Revenue Department",
    "Road Transport & Highways",
    "Rural Development",
    "Science & Technology",
    "Skill Development",
    "Social Justice & Empowerment",
    "Steel Department",
    "Textile Department",
    "Tourism Department",
    "Tribal Affairs",
    "Urban Development",
    "Women & Child Development",
    "Youth Affairs & Sports",
]

ROLE_OPTIONS = [
    {
        "key": "REVIEWER",
        "label": "Reviewer",
        "desc": "Reviews and approves extracted directives",
    },
    {
        "key": "DEPT_USER",
        "label": "Dept. User",
        "desc": "Views department action plans",
    },
    {
        "key": "ADMIN",
        "label": "Admin",
        "desc": "Full system access and user management",
    },
]

DEPARTMENT_SEED = [
    {"name": name, "code": f"DEPT-{index:03d}"}
    for index, name in enumerate(DEPARTMENT_NAMES, start=1)
]


async def seed_departments(db: AsyncSession) -> None:
    result = await db.execute(select(Department))
    existing_departments = result.scalars().all()
    existing_by_name = {department.name: department for department in existing_departments}
    used_codes = {department.code for department in existing_departments}

    created = False
    for item in DEPARTMENT_SEED:
        if item["name"] in existing_by_name:
            continue

        code = item["code"]
        if code in used_codes:
            next_index = len(used_codes) + 1
            while f"DEPT-{next_index:03d}" in used_codes:
                next_index += 1
            code = f"DEPT-{next_index:03d}"

        db.add(Department(name=item["name"], code=code))
        used_codes.add(code)
        created = True

    if created:
        await db.commit()
