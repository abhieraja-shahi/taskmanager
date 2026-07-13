# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Server

```bash
pip install -r requirements.txt
python app.py
```

The server starts on `http://0.0.0.0:5050`. Webhook endpoint: `POST /webhook/zammad`. Health check: `GET /health`.

## Testing with Sample Payload

```bash
curl -X POST http://localhost:5050/webhook/zammad \
  -H "Content-Type: application/json" \
  -H "X-Zammad-Trigger: ticket.create" \
  -d @sample_payload.json
```

## Architecture

This is a Flask webhook receiver for Zammad (helpdesk software). The data flow is:

1. **`app.py`** — Flask entry point. Receives `POST /webhook/zammad`, reads the `X-Zammad-Trigger` header, and routes payloads containing a `"ticket"` key to `handle_ticket_created()`.
2. **`ticket_parser.py`** — Parses raw Zammad JSON into typed dataclasses (`Ticket`, `Article`, `Attachment`). Handles both flat and nested field formats (e.g., `state` can be a string or `{"name": "..."}` dict). HTML bodies are stripped to plain text.
3. **`ticket_handler.py`** — Receives a parsed `Ticket` and acts on it. Currently logs a formatted summary. **This is where business logic (notifications, integrations, etc.) should be added.**

## Key Notes

- Zammad does not send a standard `event` field in the payload body — routing uses the `X-Zammad-Trigger` HTTP header instead.
- `ticket_parser.py` defensively handles both nested objects (`ticket.state.name`) and flat strings (`ticket.state`) for `state`, `priority`, `group`, and `owner`.
- `sample_payload.json` is the reference payload shape for development and manual testing.
- Python 3.14 is in use (per `__pycache__` bytecode filenames).
