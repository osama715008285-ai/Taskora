import os
import sqlite3
from datetime import datetime

from flask import Flask, render_template, request, jsonify

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None


app = Flask(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
LOCAL_DB = "taskora.db"


# =========================================================
# DATABASE
# =========================================================

def using_postgres():
    return bool(DATABASE_URL)


def get_db():
    if using_postgres():

        if psycopg is None:
            raise RuntimeError(
                "psycopg is required for PostgreSQL"
            )

        return psycopg.connect(
            DATABASE_URL,
            row_factory=dict_row
        )

    conn = sqlite3.connect(LOCAL_DB)
    conn.row_factory = sqlite3.Row

    return conn


def init_db():
    conn = get_db()

    if using_postgres():

        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                deadline TEXT NOT NULL,
                importance INTEGER NOT NULL,
                difficulty INTEGER NOT NULL,
                hours REAL NOT NULL,
                completed INTEGER DEFAULT 0,
                priority_score INTEGER DEFAULT 0
            )
        """)

    else:

        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                deadline TEXT NOT NULL,
                importance INTEGER NOT NULL,
                difficulty INTEGER NOT NULL,
                hours REAL NOT NULL,
                completed INTEGER DEFAULT 0,
                priority_score INTEGER DEFAULT 0
            )
        """)

    conn.commit()
    conn.close()


def placeholder():
    return "%s" if using_postgres() else "?"


# =========================================================
# PRIORITY
# =========================================================

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
        deadline_date - today
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
        + min(int(hours * 2), 10)
    )

    return min(score, 100)


# =========================================================
# HOME
# =========================================================

@app.route("/")
def home():
    return render_template("index.html")


# =========================================================
# GET TASKS
# =========================================================

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    conn = get_db()

    tasks = conn.execute("""
        SELECT *
        FROM tasks
        ORDER BY
            completed ASC,
            priority_score DESC
    """).fetchall()

    conn.close()

    return jsonify([
        dict(task)
        for task in tasks
    ])


# =========================================================
# ADD TASK
# =========================================================

@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Invalid request"
        }), 400

    title = data.get(
        "title",
        ""
    ).strip()

    deadline = data.get("deadline")

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

    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid numeric values"
        }), 400

    if not title or not deadline:
        return jsonify({
            "error":
            "Title and deadline are required"
        }), 400

    if not 1 <= importance <= 5:
        return jsonify({
            "error":
            "Importance must be between 1 and 5"
        }), 400

    if not 1 <= difficulty <= 5:
        return jsonify({
            "error":
            "Difficulty must be between 1 and 5"
        }), 400

    if hours <= 0:
        return jsonify({
            "error":
            "Hours must be greater than 0"
        }), 400

    try:
        score = calculate_priority(
            deadline,
            importance,
            difficulty,
            hours
        )

    except ValueError:
        return jsonify({
            "error":
            "Invalid deadline format"
        }), 400

    conn = get_db()

    p = placeholder()

    if using_postgres():

        task = conn.execute(
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
                {p}, {p}, {p},
                {p}, {p}, {p}
            )
            RETURNING *
            """,
            (
                title,
                deadline,
                importance,
                difficulty,
                hours,
                score
            )
        ).fetchone()

    else:

        cursor = conn.execute(
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
                title,
                deadline,
                importance,
                difficulty,
                hours,
                score
            )
        )

        task_id = cursor.lastrowid

        task = conn.execute(
            """
            SELECT *
            FROM tasks
            WHERE id = ?
            """,
            (task_id,)
        ).fetchone()

    conn.commit()
    conn.close()

    return jsonify(
        dict(task)
    ), 201


# =========================================================
# EDIT TASK
# =========================================================

@app.route(
    "/api/tasks/<int:task_id>",
    methods=["PUT"]
)
def edit_task(task_id):
    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Invalid request"
        }), 400

    title = data.get(
        "title",
        ""
    ).strip()

    deadline = data.get("deadline")

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

    except (ValueError, TypeError):
        return jsonify({
            "error":
            "Invalid numeric values"
        }), 400

    if not title or not deadline:
        return jsonify({
            "error":
            "Title and deadline are required"
        }), 400

    if not 1 <= importance <= 5:
        return jsonify({
            "error":
            "Importance must be between 1 and 5"
        }), 400

    if not 1 <= difficulty <= 5:
        return jsonify({
            "error":
            "Difficulty must be between 1 and 5"
        }), 400

    if hours <= 0:
        return jsonify({
            "error":
            "Hours must be greater than 0"
        }), 400

    try:
        score = calculate_priority(
            deadline,
            importance,
            difficulty,
            hours
        )

    except ValueError:
        return jsonify({
            "error":
            "Invalid deadline format"
        }), 400

    conn = get_db()
    p = placeholder()

    task = conn.execute(
        f"""
        SELECT *
        FROM tasks
        WHERE id = {p}
        """,
        (task_id,)
    ).fetchone()

    if not task:
        conn.close()

        return jsonify({
            "error": "Task not found"
        }), 404

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
            title,
            deadline,
            importance,
            difficulty,
            hours,
            score,
            task_id
        )
    )

    conn.commit()

    updated_task = conn.execute(
        f"""
        SELECT *
        FROM tasks
        WHERE id = {p}
        """,
        (task_id,)
    ).fetchone()

    conn.close()

    return jsonify(
        dict(updated_task)
    )


# =========================================================
# TOGGLE TASK
# =========================================================

@app.route(
    "/api/tasks/<int:task_id>/toggle",
    methods=["PUT"]
)
def toggle_task(task_id):
    conn = get_db()
    p = placeholder()

    task = conn.execute(
        f"""
        SELECT completed
        FROM tasks
        WHERE id = {p}
        """,
        (task_id,)
    ).fetchone()

    if not task:
        conn.close()

        return jsonify({
            "error": "Task not found"
        }), 404

    new_status = (
        0
        if task["completed"]
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
            task_id
        )
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "completed": new_status
    })


# =========================================================
# DELETE TASK
# =========================================================

@app.route(
    "/api/tasks/<int:task_id>",
    methods=["DELETE"]
)
def delete_task(task_id):
    conn = get_db()
    p = placeholder()

    task = conn.execute(
        f"""
        SELECT id
        FROM tasks
        WHERE id = {p}
        """,
        (task_id,)
    ).fetchone()

    if not task:
        conn.close()

        return jsonify({
            "error": "Task not found"
        }), 404

    conn.execute(
        f"""
        DELETE FROM tasks
        WHERE id = {p}
        """,
        (task_id,)
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True
    })


# =========================================================
# STATS
# =========================================================

@app.route(
    "/api/stats",
    methods=["GET"]
)
def get_stats():
    conn = get_db()

    total = conn.execute("""
        SELECT COUNT(*)
        FROM tasks
    """).fetchone()[0]

    completed = conn.execute("""
        SELECT COUNT(*)
        FROM tasks
        WHERE completed = 1
    """).fetchone()[0]

    urgent = conn.execute("""
        SELECT COUNT(*)
        FROM tasks
        WHERE priority_score >= 80
        AND completed = 0
    """).fetchone()[0]

    conn.close()

    productivity = (
        0
        if total == 0
        else round(
            (completed / total)
            * 100
        )
    )

    return jsonify({
        "total": total,
        "completed": completed,
        "urgent": urgent,
        "productivity": productivity
    })


# Create database table when Vercel imports app.py
init_db()


# =========================================================
# LOCAL START
# =========================================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )