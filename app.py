import os
import sqlite3
from datetime import datetime

from flask import Flask, jsonify, render_template, request

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None


app = Flask(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
IS_VERCEL = bool(os.getenv("VERCEL"))

LOCAL_DB = "/tmp/taskora.db" if IS_VERCEL else "taskora.db"

_db_initialized = False


def using_postgres():
    return bool(DATABASE_URL)


def connect_db():
    if using_postgres():
        if psycopg is None:
            raise RuntimeError(
                "DATABASE_URL is set but psycopg is not installed."
            )

        return psycopg.connect(
            DATABASE_URL,
            row_factory=dict_row,
            connect_timeout=10,
        )

    conn = sqlite3.connect(
        LOCAL_DB,
        timeout=10
    )

    conn.row_factory = sqlite3.Row

    return conn


def init_db():
    conn = connect_db()

    try:
        if using_postgres():
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    deadline TEXT NOT NULL,
                    importance INTEGER NOT NULL,
                    difficulty INTEGER NOT NULL,
                    hours REAL NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    priority_score INTEGER NOT NULL DEFAULT 0
                )
                """
            )

        else:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    deadline TEXT NOT NULL,
                    importance INTEGER NOT NULL,
                    difficulty INTEGER NOT NULL,
                    hours REAL NOT NULL,
                    completed INTEGER NOT NULL DEFAULT 0,
                    priority_score INTEGER NOT NULL DEFAULT 0
                )
                """
            )

        conn.commit()

    finally:
        conn.close()


def ensure_db_initialized():
    global _db_initialized

    if not _db_initialized:
        init_db()
        _db_initialized = True


def get_db():
    ensure_db_initialized()

    return connect_db()


def placeholder():
    return "%s" if using_postgres() else "?"


def calculate_priority(
    deadline,
    importance,
    difficulty,
    hours
):
    deadline_date = datetime.strptime(
        deadline,
        "%Y-%m-%d"
    ).date()

    today = datetime.now().date()

    days_left = (
        deadline_date -
        today
    ).days

    if days_left <= 0:
        deadline_score = 40

    elif days_left == 1:
        deadline_score = 35

    elif days_left <= 3:
        deadline_score = 25

    elif days_left <= 7:
        deadline_score = 15

    else:
        deadline_score = 5

    score = (
        importance * 8
        + difficulty * 4
        + deadline_score
        + min(
            int(hours * 2),
            10
        )
    )

    return min(
        score,
        100
    )


def parse_task_payload(data):
    if not data:
        return None, (
            "Invalid request",
            400
        )

    title = str(
        data.get(
            "title",
            ""
        )
    ).strip()

    deadline = data.get(
        "deadline"
    )

    try:
        importance = int(
            data.get(
                "importance",
                3
            )
        )

        difficulty = int(
            data.get(
                "difficulty",
                3
            )
        )

        hours = float(
            data.get(
                "hours",
                1
            )
        )

    except (
        ValueError,
        TypeError
    ):
        return None, (
            "Invalid numeric values",
            400
        )

    if not title or not deadline:
        return None, (
            "Title and deadline are required",
            400
        )

    if not 1 <= importance <= 5:
        return None, (
            "Importance must be between 1 and 5",
            400
        )

    if not 1 <= difficulty <= 5:
        return None, (
            "Difficulty must be between 1 and 5",
            400
        )

    if hours <= 0:
        return None, (
            "Hours must be greater than 0",
            400
        )

    try:
        score = calculate_priority(
            deadline,
            importance,
            difficulty,
            hours
        )

    except ValueError:
        return None, (
            "Invalid deadline format",
            400
        )

    return {
        "title": title,
        "deadline": deadline,
        "importance": importance,
        "difficulty": difficulty,
        "hours": hours,
        "priority_score": score,
    }, None


@app.route("/")
def home():
    return render_template(
        "index.html"
    )


@app.route(
    "/api/health",
    methods=["GET"]
)
def health():
    return jsonify(
        {
            "status": "ok",
            "database": (
                "postgresql"

                if using_postgres()

                else (
                    "sqlite-temporary"

                    if IS_VERCEL

                    else "sqlite-local"
                )
            )
        }
    )


@app.route(
    "/api/tasks",
    methods=["GET"]
)
def get_tasks():
    try:
        conn = get_db()

        try:
            rows = conn.execute(
                """
                SELECT *
                FROM tasks
                ORDER BY
                    completed ASC,
                    priority_score DESC,
                    id DESC
                """
            ).fetchall()

        finally:
            conn.close()

        return jsonify(
            [
                dict(row)
                for row in rows
            ]
        )

    except Exception:
        app.logger.exception(
            "Unable to load tasks"
        )

        return jsonify(
            {
                "error":
                    "Unable to load tasks"
            }
        ), 500


@app.route(
    "/api/tasks",
    methods=["POST"]
)
def add_task():
    payload, error = parse_task_payload(
        request.get_json(
            silent=True
        )
    )

    if error:
        message, status = error

        return jsonify(
            {
                "error":
                    message
            }
        ), status

    try:
        conn = get_db()
        p = placeholder()

        try:
            if using_postgres():
                row = conn.execute(
                    f"""
                    INSERT INTO tasks (
                        title,
                        deadline,
                        importance,
                        difficulty,
                        hours,
                        priority_score
                    )
                    VALUES (
                        {p},
                        {p},
                        {p},
                        {p},
                        {p},
                        {p}
                    )
                    RETURNING *
                    """,
                    (
                        payload["title"],
                        payload["deadline"],
                        payload["importance"],
                        payload["difficulty"],
                        payload["hours"],
                        payload["priority_score"],
                    )
                ).fetchone()

            else:
                cur = conn.execute(
                    """
                    INSERT INTO tasks (
                        title,
                        deadline,
                        importance,
                        difficulty,
                        hours,
                        priority_score
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        payload["title"],
                        payload["deadline"],
                        payload["importance"],
                        payload["difficulty"],
                        payload["hours"],
                        payload["priority_score"],
                    )
                )

                task_id = cur.lastrowid

                row = conn.execute(
                    """
                    SELECT *
                    FROM tasks
                    WHERE id = ?
                    """,
                    (
                        task_id,
                    )
                ).fetchone()

            conn.commit()

        finally:
            conn.close()

        return jsonify(
            dict(row)
        ), 201

    except Exception:
        app.logger.exception(
            "Unable to create task"
        )

        return jsonify(
            {
                "error":
                    "Unable to save task"
            }
        ), 500


@app.route(
    "/api/tasks/<int:task_id>",
    methods=["PUT"]
)
def edit_task(task_id):
    payload, error = parse_task_payload(
        request.get_json(
            silent=True
        )
    )

    if error:
        message, status = error

        return jsonify(
            {
                "error":
                    message
            }
        ), status

    try:
        conn = get_db()
        p = placeholder()

        try:
            existing = conn.execute(
                f"""
                SELECT id
                FROM tasks
                WHERE id = {p}
                """,
                (
                    task_id,
                )
            ).fetchone()

            if not existing:
                return jsonify(
                    {
                        "error":
                            "Task not found"
                    }
                ), 404

            conn.execute(
                f"""
                UPDATE tasks
                SET
                    title = {p},
                    deadline = {p},
                    importance = {p},
                    difficulty = {p},
                    hours = {p},
                    priority_score = {p}
                WHERE id = {p}
                """,
                (
                    payload["title"],
                    payload["deadline"],
                    payload["importance"],
                    payload["difficulty"],
                    payload["hours"],
                    payload["priority_score"],
                    task_id,
                )
            )

            conn.commit()

            row = conn.execute(
                f"""
                SELECT *
                FROM tasks
                WHERE id = {p}
                """,
                (
                    task_id,
                )
            ).fetchone()

        finally:
            conn.close()

        return jsonify(
            dict(row)
        )

    except Exception:
        app.logger.exception(
            "Unable to update task"
        )

        return jsonify(
            {
                "error":
                    "Unable to update task"
            }
        ), 500


@app.route(
    "/api/tasks/<int:task_id>/toggle",
    methods=["PUT"]
)
def toggle_task(task_id):
    try:
        conn = get_db()
        p = placeholder()

        try:
            row = conn.execute(
                f"""
                SELECT completed
                FROM tasks
                WHERE id = {p}
                """,
                (
                    task_id,
                )
            ).fetchone()

            if not row:
                return jsonify(
                    {
                        "error":
                            "Task not found"
                    }
                ), 404

            new_status = (
                0
                if row["completed"]
                else 1
            )

            conn.execute(
                f"""
                UPDATE tasks
                SET completed = {p}
                WHERE id = {p}
                """,
                (
                    new_status,
                    task_id,
                )
            )

            conn.commit()

        finally:
            conn.close()

        return jsonify(
            {
                "success": True,
                "completed":
                    new_status
            }
        )

    except Exception:
        app.logger.exception(
            "Unable to toggle task"
        )

        return jsonify(
            {
                "error":
                    "Unable to update task"
            }
        ), 500


@app.route(
    "/api/tasks/<int:task_id>",
    methods=["DELETE"]
)
def delete_task(task_id):
    try:
        conn = get_db()
        p = placeholder()

        try:
            row = conn.execute(
                f"""
                SELECT id
                FROM tasks
                WHERE id = {p}
                """,
                (
                    task_id,
                )
            ).fetchone()

            if not row:
                return jsonify(
                    {
                        "error":
                            "Task not found"
                    }
                ), 404

            conn.execute(
                f"""
                DELETE FROM tasks
                WHERE id = {p}
                """,
                (
                    task_id,
                )
            )

            conn.commit()

        finally:
            conn.close()

        return jsonify(
            {
                "success":
                    True
            }
        )

    except Exception:
        app.logger.exception(
            "Unable to delete task"
        )

        return jsonify(
            {
                "error":
                    "Unable to delete task"
            }
        ), 500


@app.route(
    "/api/stats",
    methods=["GET"]
)
def get_stats():
    try:
        conn = get_db()

        try:
            total = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM tasks
                """
            ).fetchone()["count"]

            completed = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM tasks
                WHERE completed = 1
                """
            ).fetchone()["count"]

            urgent = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM tasks
                WHERE priority_score >= 80
                AND completed = 0
                """
            ).fetchone()["count"]

        finally:
            conn.close()

        productivity = (
            0

            if total == 0

            else round(
                (
                    completed /
                    total
                )
                *
                100
            )
        )

        return jsonify(
            {
                "total":
                    int(total),

                "completed":
                    int(completed),

                "urgent":
                    int(urgent),

                "productivity":
                    productivity
            }
        )

    except Exception:
        app.logger.exception(
            "Unable to load stats"
        )

        return jsonify(
            {
                "error":
                    "Unable to load statistics"
            }
        ), 500


if __name__ == "__main__":
    init_db()

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )