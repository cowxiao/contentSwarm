"""验证当前部署的 Blueprint First 默认入口及新任务版本，不调用模型。"""

import json
import os
import re
import secrets
import socket
import uuid

import httpx
import pytest
from patchright.async_api import async_playwright, expect

from yuxi.content.v3.joint_workflow import PLATFORM_WORKFLOW_PRICE_RECOVERY_ID
from yuxi.storage.postgres.manager import pg_manager
from yuxi.storage.postgres.models_business import Department, User
from yuxi.utils.auth_utils import AuthUtils


@pytest.mark.e2e
@pytest.mark.asyncio
async def test_deployed_templates_create_blueprint_first_tasks():
    pg_manager.initialize()
    uid = f"blueprint_test_{uuid.uuid4().hex}"
    password = secrets.token_urlsafe(24)
    async with pg_manager.AsyncSession() as db:
        department = Department(name=uid)
        db.add(department)
        await db.flush()
        department_id = department.id
        user = User(
            username=uid,
            uid=uid,
            password_hash=AuthUtils.hash_password(password),
            role="user",
            department_id=department_id,
        )
        db.add(user)
        await db.commit()
        user_id = user.id
    try:
        async with httpx.AsyncClient(
            base_url=os.getenv("TEST_BASE_URL", "http://localhost:5050"), timeout=30
        ) as client:
            response = await client.post("/api/auth/token", data={"username": uid, "password": password})
            response.raise_for_status()
            token = response.json()["access_token"]
            client.headers["Authorization"] = f"Bearer {token}"
            response = await client.get("/api/content/bootstrap")
            response.raise_for_status()
            templates = response.json()["industry_templates"]
            assert len(templates) == 6
            for template in templates:
                assert template["blueprint_first"], template["id"]
                assert template["default_workflow_version_id"] == PLATFORM_WORKFLOW_PRICE_RECOVERY_ID
                response = await client.post(
                    "/api/content/tasks",
                    json={
                        "industry_template_id": template["id"],
                        "name": "pytest Blueprint First default",
                        "content_goal": template["default_goal"],
                        "creation_mode": "original",
                    },
                )
                response.raise_for_status()
                task = response.json()["task"]
                try:
                    assert task["workflow_version_id"] == PLATFORM_WORKFLOW_PRICE_RECOVERY_ID
                finally:
                    response = await client.delete(f"/api/content/tasks/{task['id']}")
                    response.raise_for_status()
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", f"--host-resolver-rules=MAP localhost {socket.gethostbyname('web')}"],
                )
                try:
                    context = await browser.new_context()
                    await context.add_init_script(f"localStorage.setItem('user_token', {json.dumps(token)})")
                    page = await context.new_page()
                    await page.goto("http://localhost:5173/content/new")
                    for industry in ("装修", "教育"):
                        await page.get_by_role("button", name=re.compile(industry)).first.click()
                        await expect(page.locator(".auto-strategy-hint")).to_be_visible()
                        await expect(page.get_by_text("一级内容方向", exact=True)).to_have_count(0)
                finally:
                    await browser.close()
    finally:
        async with pg_manager.AsyncSession() as db:
            await db.delete(await db.get(User, user_id))
            await db.delete(await db.get(Department, department_id))
            await db.commit()
        await pg_manager.async_engine.dispose()
