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
        f'<p style="margin:0 0 8px 0;color:#94a3b8;font-size:14px;line-height:1.6;">'
        f'{task_description}</p>'
        if task_description
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Task Assigned</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:32px;" align="center">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);
                              border-radius:12px;padding:10px 20px;">
                    <span style="font-size:20px;font-weight:700;color:#ffffff;
                                 letter-spacing:0.5px;">&#9670; Ethereal</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#1e293b;border-radius:16px;
                       border:1px solid #334155;overflow:hidden;">

              <!-- Card top accent -->
              <tr>
                <td style="background:linear-gradient(90deg,#6366f1,#8b5cf6,#06b6d4);
                           height:4px;display:block;"></td>
              </tr>

              <!-- Card body -->
              <tr>
                <td style="padding:40px 40px 32px;">

                  <!-- Icon + heading -->
                  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                    <tr>
                      <td style="vertical-align:middle;padding-right:16px;">
                        <div style="width:48px;height:48px;border-radius:12px;
                                    background:linear-gradient(135deg,#6366f1,#8b5cf6);
                                    text-align:center;line-height:48px;
                                    font-size:22px;">&#128203;</div>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:11px;font-weight:600;
                                  letter-spacing:1.5px;color:#6366f1;
                                  text-transform:uppercase;">New Assignment</p>
                        <h1 style="margin:4px 0 0;font-size:22px;font-weight:700;
                                   color:#f1f5f9;line-height:1.3;">
                          You have a new task
                        </h1>
                      </td>
                    </tr>
                  </table>

                  <!-- Greeting -->
                  <p style="margin:0 0 24px;font-size:16px;color:#cbd5e1;line-height:1.6;">
                    Hi <strong style="color:#f1f5f9;">{assignee_name}</strong>,
                    <br/>
                    <strong style="color:#a5b4fc;">{assigned_by}</strong> has assigned
                    you a task that requires your attention.
                  </p>

                  <!-- Task card -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="background-color:#0f172a;border-radius:12px;
                                border:1px solid #334155;margin-bottom:28px;">
                    <tr>
                      <td style="padding:24px;">
                        <p style="margin:0 0 4px 0;font-size:11px;font-weight:600;
                                  letter-spacing:1.5px;color:#6366f1;
                                  text-transform:uppercase;">Task</p>
                        <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;
                                   color:#f1f5f9;line-height:1.4;">
                          {task_title}
                        </h2>
                        {desc_block}
                        <!-- Divider -->
                        <table width="100%" cellpadding="0" cellspacing="0" border="0"
                               style="border-top:1px solid #1e293b;margin:16px 0;">
                          <tr><td></td></tr>
                        </table>
                        <!-- Meta row -->
                        <table cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="padding-right:32px;">
                              <p style="margin:0;font-size:11px;font-weight:600;
                                        letter-spacing:1px;color:#64748b;
                                        text-transform:uppercase;">Due Date</p>
                              <p style="margin:4px 0 0;font-size:14px;font-weight:600;
                                        color:#f59e0b;">
                                &#128197; {due_date}
                              </p>
                            </td>
                            <td>
                              <p style="margin:0;font-size:11px;font-weight:600;
                                        letter-spacing:1px;color:#64748b;
                                        text-transform:uppercase;">Assigned By</p>
                              <p style="margin:4px 0 0;font-size:14px;font-weight:600;
                                        color:#a5b4fc;">
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
                      <td style="border-radius:10px;
                                 background:linear-gradient(135deg,#6366f1,#8b5cf6);">
                        <a href="{APP_URL}"
                           style="display:inline-block;padding:14px 32px;
                                  font-size:15px;font-weight:600;color:#ffffff;
                                  text-decoration:none;letter-spacing:0.3px;">
                          View Task &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Login note -->
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"
                         style="background-color:#1e3a5f22;border-radius:8px;
                                border:1px solid #1d4ed840;margin-bottom:8px;">
                    <tr>
                      <td style="padding:14px 18px;">
                        <p style="margin:0;font-size:13px;color:#93c5fd;line-height:1.5;">
                          &#128274;&nbsp;
                          Log in to <strong>{APP_URL}</strong> with your credentials
                          to review and accept this task.
                        </p>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 8px;" align="center">
              <p style="margin:0 0 6px;font-size:12px;color:#475569;">
                This is an automated notification from
                <strong style="color:#6366f1;">Ethereal Task Tracker</strong>.
              </p>
              <p style="margin:0;font-size:11px;color:#334155;">
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
