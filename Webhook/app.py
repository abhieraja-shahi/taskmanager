import sys
import os
import json
sys.path.insert(0, os.path.dirname(__file__))

import logging
from flask import Flask, request, jsonify
from ticket_handler import handle_ticket_created

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)


@app.route("/", methods=["POST"])
@app.route("/webhook/zammad", methods=["POST"])
def zammad_webhook():
    """Entry point for all Zammad webhook events.

    Note: Zammad does NOT send an 'event' field.
    We use the X-Zammad-Trigger header and payload keys to route.
    """
    payload = request.get_json(silent=True)
    logger.info("RAW PAYLOAD:\n%s", json.dumps(payload, indent=2, ensure_ascii=False))
    if payload is None:
        logger.warning("Received non-JSON or empty payload")
        return jsonify({"error": "Invalid JSON"}), 400

    trigger = request.headers.get("X-Zammad-Trigger", "unknown")
    logger.info("Received Zammad trigger: '%s'", trigger)

    if "ticket" in payload:
        handle_ticket_created(payload)
    else:
        logger.warning("No 'ticket' key in payload — skipping")

    return jsonify({"status": "ok"}), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
