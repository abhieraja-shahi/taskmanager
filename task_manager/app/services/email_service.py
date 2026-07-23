import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List

from app.config import settings

logger = logging.getLogger(__name__)

APP_URL = "http://192.168.2.69"


def _build_assignment_html(
    assignee_name: str,
    task_title: str,
    task_description: str,
    due_date: str,
    assigned_by: str,
    task_id: int,
) -> str:
    desc_block = (
        f'<p style="margin:0 0 12px 0;font-size:14px;color:#6B7280;line-height:1.6;">'
        f'{task_description}</p>'
        if task_description
        else ""
    )

    logo_url = f"{APP_URL}/ethereal-logo-white.png"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Task Assigned</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F9FF;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#F5F9FF;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;">

          <!-- Header — navy brand bar -->
          <tr>
            <td style="background-color:#191e5c;border-radius:12px 12px 0 0;
                       padding:24px 32px;" align="left">
              <img src="{logo_url}"
                   alt="Ethereal Informatics"
                   width="180" height="auto"
                   style="display:block;border:0;max-width:180px;" />
            </td>
          </tr>

          <!-- Teal accent bar -->
          <tr>
            <td style="background-color:#55D7B3;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Card body -->
          <tr>
            <td style="background-color:#FFFFFF;border:1px solid #E5EAF2;
                       border-top:none;border-radius:0 0 12px 12px;padding:40px 40px 32px;">

              <!-- Badge + heading -->
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;
                        letter-spacing:1.5px;color:#55D7B3;text-transform:uppercase;">
                New Assignment
              </p>
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;
                         color:#191e5c;line-height:1.3;">
                You have a new task
              </h1>

              <!-- Greeting -->
              <p style="margin:0 0 28px;font-size:15px;color:#434242;line-height:1.7;">
                Hi <strong style="color:#191e5c;">{assignee_name}</strong>,<br/>
                <strong style="color:#191e5c;">{assigned_by}</strong> has assigned
                you a task that requires your attention.
              </p>

              <!-- Task card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background-color:#F5F9FF;border-radius:10px;
                            border:1px solid #E5EAF2;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;
                              letter-spacing:1.5px;color:#191e5c;text-transform:uppercase;">
                      Task
                    </p>
                    <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;
                               color:#191e5c;line-height:1.4;">
                      {task_title}
                    </h2>
                    {desc_block}
                    <!-- Divider -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="border-top:1px solid #E5EAF2;padding-top:16px;"></td></tr>
                    </table>
                    <!-- Meta row -->
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">
                      <tr>
                        <td style="padding-right:40px;">
                          <p style="margin:0;font-size:11px;font-weight:600;
                                    letter-spacing:1px;color:#9CA3AF;text-transform:uppercase;">
                            Due Date
                          </p>
                          <p style="margin:4px 0 0;font-size:14px;font-weight:600;
                                    color:#D97706;">
                            &#128197; {due_date}
                          </p>
                        </td>
                        <td>
                          <p style="margin:0;font-size:11px;font-weight:600;
                                    letter-spacing:1px;color:#9CA3AF;text-transform:uppercase;">
                            Assigned By
                          </p>
                          <p style="margin:4px 0 0;font-size:14px;font-weight:600;
                                    color:#191e5c;">
                            &#128100; {assigned_by}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-radius:8px;background-color:#191e5c;">
                    <a href="{APP_URL}"
                       style="display:inline-block;padding:13px 30px;font-size:14px;
                              font-weight:600;color:#ffffff;text-decoration:none;
                              letter-spacing:0.3px;">
                      View Task &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Login note -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background-color:#EBF3FF;border-radius:8px;
                            border:1px solid #CFE5FF;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#434242;line-height:1.5;">
                      &#128274;&nbsp;
                      Log in to <strong style="color:#191e5c;">{APP_URL}</strong>
                      with your credentials to review and accept this task.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 8px;" align="center">
              <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
                This is an automated notification from
                <strong style="color:#191e5c;">Ethereal Informatics Task Manager</strong>.
              </p>
              <p style="margin:0;font-size:11px;color:#9CA3AF;">
                Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_smtp(to_email: str, subject: str, html_body: str) -> None:
    """Blocking SMTP send — run via asyncio.to_thread."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(msg["From"], [to_email], msg.as_string())


async def send_assignment_email(
    assignees: List[dict],  # [{"email": str, "username": str}, ...]
    task_title: str,
    task_description: str,
    due_date: str,
    assigned_by_name: str,
    task_id: int,
) -> None:
    """Send task assignment emails to all assignees. Silently skips if SMTP is disabled."""
    if not settings.SMTP_ENABLED or not settings.SMTP_HOST:
        return

    for assignee in assignees:
        email = assignee.get("email", "")
        name = assignee.get("username", "User")
        if not email:
            continue

        subject = f"New Task Assigned: {task_title}"
        html = _build_assignment_html(
            assignee_name=name,
            task_title=task_title,
            task_description=task_description or "",
            due_date=due_date,
            assigned_by=assigned_by_name,
            task_id=task_id,
        )

        try:
            await asyncio.to_thread(_send_smtp, email, subject, html)
            logger.info("Assignment email sent to %s for task_id=%s", email, task_id)
        except Exception as exc:
            logger.error(
                "Failed to send assignment email to %s for task_id=%s: %s",
                email, task_id, exc,
            )
