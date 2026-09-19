const modal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("taskSearch");
const filterButtons = document.querySelectorAll(".filter-btn");
const navItems = document.querySelectorAll(".nav-item");

const reminderMode = document.getElementById("reminderMode");
const reminderTime = document.getElementById("reminderTime");
const customDaysInput = document.getElementById("customDays");
const customDaysGroup = document.getElementById("customDaysGroup");
const voiceLanguage = document.getElementById("voiceLanguage");
const voiceStyle = document.getElementById("voiceStyle");
const voiceSelector = document.getElementById("voiceSelector");
const voiceEnabled = document.getElementById("voiceEnabled");
const voiceStateText = document.getElementById("voiceStateText");
const requestNotificationBtn = document.getElementById("requestNotificationBtn");
const testVoiceBtn = document.getElementById("testVoiceBtn");
const notificationStatus = document.getElementById("notificationStatus");
const tasksSection = document.getElementById("tasksSection");
const prioritySection = document.getElementById("smartFocus");

const REMINDER_STORAGE_KEY = "taskora_reminders_v2";

let allTasks = [];
let currentFilter = "all";
let editingTaskId = null;
let availableVoices = [];

/* =========================================================
   HELPERS
========================================================= */

function setText(id, value) {
    const el = document.getElementById(id);

    if (el) {
        el.textContent = value;
    }
}

function escapeHTML(value) {
    const div = document.createElement("div");

    div.textContent =
        String(
            value ?? ""
        );

    return div.innerHTML;
}

function startOfToday() {
    const now =
        new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
}

function parseTaskDate(value) {
    const [
        year,
        month,
        day
    ] =
        String(value)
            .split("-")
            .map(Number);

    return new Date(
        year,
        month - 1,
        day
    );
}

function formatDate(value) {
    return parseTaskDate(
        value
    )
        .toLocaleDateString(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        );
}

function getDeadlineStatus(value) {
    const date =
        parseTaskDate(
            value
        );

    const today =
        startOfToday();

    if (
        date <
        today
    ) {
        return {
            text: "Overdue",
            className:
                "deadline-overdue"
        };
    }

    if (
        date.getTime() ===
        today.getTime()
    ) {
        return {
            text: "Due Today",
            className:
                "deadline-today"
        };
    }

    return null;
}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "success"
) {
    let container =
        document.querySelector(
            ".toast-container"
        );

    if (!container) {
        container =
            document.createElement(
                "div"
            );

        container.className =
            "toast-container";

        document.body.appendChild(
            container
        );
    }

    const icons = {
        success: "✓",
        error: "×",
        warning: "!",
        info: "i"
    };

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast ${type}`;

    toast.innerHTML = `
        <div class="toast-icon">
            ${icons[type] || "i"}
        </div>

        <div class="toast-message">
            ${escapeHTML(message)}
        </div>
    `;

    container.appendChild(
        toast
    );

    setTimeout(
        () => {

            toast.classList.add(
                "hide"
            );

            setTimeout(
                () =>
                    toast.remove(),
                300
            );

        },
        3200
    );
}


/* =========================================================
   MODAL
========================================================= */

function openTaskModal() {

    editingTaskId =
        null;

    taskForm.reset();

    document
        .getElementById(
            "importance"
        )
        .value =
        "3";

    document
        .getElementById(
            "difficulty"
        )
        .value =
        "3";

    document
        .getElementById(
            "hours"
        )
        .value =
        "1";

    setReminderFormValues(
        {
            mode:
                "smart",

            time:
                "18:00",

            customDays:
                2,

            voiceEnabled:
                true,

            language:
                "en",

            voiceStyle:
                "premium"
        }
    );

    document
        .querySelector(
            ".modal-header h2"
        )
        .textContent =
        "Add Academic Task";

    document
        .querySelector(
            ".modal-header p"
        )
        .textContent =
        "NEW TASK";

    document
        .querySelector(
            ".create-task-btn"
        )
        .textContent =
        "Create Task";

    modal.classList.add(
        "show"
    );
}

function closeTaskModal() {

    modal.classList.remove(
        "show"
    );

    editingTaskId =
        null;
}

window.addEventListener(
    "click",
    (event) => {

        if (
            event.target ===
            modal
        ) {
            closeTaskModal();
        }
    }
);

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key ===
                "Escape"

            &&

            !document.querySelector(
                ".taskora-confirm-overlay"
            )
        ) {
            closeTaskModal();
        }
    }
);


/* =========================================================
   SAVE TASK
========================================================= */

taskForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const taskData = {

            title:
                document
                    .getElementById(
                        "title"
                    )
                    .value
                    .trim(),

            deadline:
                document
                    .getElementById(
                        "deadline"
                    )
                    .value,

            importance:
                document
                    .getElementById(
                        "importance"
                    )
                    .value,

            difficulty:
                document
                    .getElementById(
                        "difficulty"
                    )
                    .value,

            hours:
                document
                    .getElementById(
                        "hours"
                    )
                    .value
        };

        if (
            !taskData.title ||
            !taskData.deadline ||
            !taskData.hours
        ) {

            showToast(
                "Please complete all required fields.",
                "warning"
            );

            return;
        }

        const reminderConfig =
            getReminderFormValues();

        const wasEditing =
            editingTaskId !==
            null;

        const oldId =
            editingTaskId;

        const url =
            wasEditing

                ? `/api/tasks/${editingTaskId}`

                : "/api/tasks";

        const method =
            wasEditing

                ? "PUT"

                : "POST";

        try {

            const response =
                await fetch(
                    url,
                    {
                        method,

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                taskData
                            )
                    }
                );

            const data =
                await response
                    .json()
                    .catch(
                        () => ({})
                    );

            if (
                !response.ok
            ) {

                throw new Error(
                    data.error ||
                    "Unable to save task"
                );
            }

            const savedId =
                wasEditing

                    ? oldId

                    : data.id;

            if (
                savedId !== undefined &&
                savedId !== null
            ) {

                saveReminderConfig(
                    savedId,
                    reminderConfig
                );
            }

            closeTaskModal();

            await loadTasks();

            showToast(

                wasEditing

                    ? "Task updated successfully."

                    : "Task created successfully.",

                "success"
            );

        } catch (error) {

            console.error(
                error
            );

            showToast(

                error.message ||
                "Unable to save task.",

                "error"
            );
        }
    }
);


/* =========================================================
   LOAD TASKS
========================================================= */

async function loadTasks() {

    try {

        const response =
            await fetch(
                "/api/tasks",
                {
                    cache:
                        "no-store"
                }
            );

        if (
            !response.ok
        ) {

            throw new Error(
                "Unable to load tasks"
            );
        }

        allTasks =
            await response.json();

        syncReminderStoreWithTasks(
            allTasks
        );

        applyFilters();

        updateStats(
            allTasks
        );

        updateDeadlineInsights(
            allTasks
        );

        renderSmartFocus(
            allTasks
        );

        checkTaskoraReminders();

    } catch (error) {

        console.error(
            error
        );

        taskList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    !
                </div>

                <h3>
                    Unable to load tasks
                </h3>

                <p>
                    Please try again in a moment.
                </p>

            </div>

        `;

        showToast(
            "Unable to load tasks.",
            "error"
        );
    }
}


/* =========================================================
   PRIORITY
========================================================= */

function getPriorityInfo(
    score
) {

    if (
        score >= 80
    ) {

        return {

            label:
                "Urgent",

            className:
                "score-high",

            color:
                "#ff5d73"
        };
    }

    if (
        score >= 60
    ) {

        return {

            label:
                "High",

            className:
                "score-medium",

            color:
                "#f6c85f"
        };
    }

    if (
        score >= 40
    ) {

        return {

            label:
                "Medium",

            className:
                "score-medium",

            color:
                "#f6c85f"
        };
    }

    return {

        label:
            "Low",

        className:
            "score-low",

        color:
            "#31d39b"
    };
}


/* =========================================================
   RENDER TASKS
========================================================= */

function renderTasks(
    tasks
) {

    if (
        !tasks.length
    ) {

        taskList.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    ✓
                </div>

                <h3>
                    No tasks found
                </h3>

                <p>
                    Add a task or change your search filters.
                </p>

            </div>

        `;

        return;
    }

    taskList.innerHTML =
        tasks
            .map(
                (task) => {

                    const priority =
                        getPriorityInfo(
                            task.priority_score
                        );

                    const deadlineStatus =
                        getDeadlineStatus(
                            task.deadline
                        );

                    return `

                        <div
                            class="task-card ${
                                task.completed
                                    ? "completed"
                                    : ""
                            }"
                        >

                            <div class="task-main">

                                <div
                                    class="priority-line"
                                    style="background:${priority.color}"
                                ></div>

                                <div class="task-info">

                                    <h3>
                                        ${escapeHTML(
                                            task.title
                                        )}
                                    </h3>

                                    <div class="task-meta">

                                        <span>
                                            📅 ${formatDate(
                                                task.deadline
                                            )}
                                        </span>

                                        ${
                                            deadlineStatus &&
                                            !task.completed

                                                ? `
                                                    <span
                                                        class="${deadlineStatus.className}"
                                                    >
                                                        ${deadlineStatus.text}
                                                    </span>
                                                `

                                                : ""
                                        }

                                        <span>
                                            ⏱ ${task.hours}h
                                        </span>

                                        <span>
                                            Importance ${task.importance}/5
                                        </span>

                                        <span>
                                            Difficulty ${task.difficulty}/5
                                        </span>

                                        <span
                                            class="${priority.className}"
                                        >
                                            ${priority.label}
                                        </span>

                                        ${
                                            renderReminderBadge(
                                                task.id
                                            )
                                        }

                                    </div>

                                </div>

                            </div>

                            <div class="task-actions">

                                <div
                                    class="score ${priority.className}"
                                >
                                    ${task.priority_score}/100
                                </div>

                                <button
                                    class="task-action edit-btn"
                                    type="button"
                                    onclick="editTask(${task.id})"
                                    title="Edit task"
                                >
                                    ✏️
                                </button>

                                <button
                                    class="task-action complete-btn"
                                    type="button"
                                    onclick="toggleTask(${task.id})"
                                    title="${
                                        task.completed

                                            ? "Mark as active"

                                            : "Mark as completed"
                                    }"
                                >
                                    ${
                                        task.completed

                                            ? "↺"

                                            : "✓"
                                    }
                                </button>

                                <button
                                    class="task-action delete-btn"
                                    type="button"
                                    onclick="deleteTask(${task.id})"
                                    title="Delete task"
                                >
                                    ×
                                </button>

                            </div>

                        </div>

                    `;
                }
            )
            .join("");
}


/* =========================================================
   EDIT TASK
========================================================= */

function editTask(
    id
) {

    const task =
        allTasks.find(
            (item) =>
                item.id ===
                id
        );

    if (
        !task
    ) {

        showToast(
            "Task not found.",
            "error"
        );

        return;
    }

    editingTaskId =
        id;

    document
        .getElementById(
            "title"
        )
        .value =
        task.title;

    document
        .getElementById(
            "deadline"
        )
        .value =
        task.deadline;

    document
        .getElementById(
            "importance"
        )
        .value =
        task.importance;

    document
        .getElementById(
            "difficulty"
        )
        .value =
        task.difficulty;

    document
        .getElementById(
            "hours"
        )
        .value =
        task.hours;

    setReminderFormValues(

        getReminderConfig(
            id
        )

        ||

        {
            mode:
                "none",

            time:
                "18:00",

            customDays:
                2,

            voiceEnabled:
                true,

            language:
                "en",

            voiceStyle:
                "premium"
        }
    );

    document
        .querySelector(
            ".modal-header h2"
        )
        .textContent =
        "Edit Academic Task";

    document
        .querySelector(
            ".modal-header p"
        )
        .textContent =
        "EDIT TASK";

    document
        .querySelector(
            ".create-task-btn"
        )
        .textContent =
        "Save Changes";

    modal.classList.add(
        "show"
    );
}


/* =========================================================
   TOGGLE TASK
========================================================= */

async function toggleTask(
    id
) {

    const task =
        allTasks.find(
            (item) =>
                item.id ===
                id
        );

    const wasCompleted =
        task

            ? task.completed ===
                1

            : false;

    try {

        const response =
            await fetch(

                `/api/tasks/${id}/toggle`,

                {
                    method:
                        "PUT"
                }
            );

        if (
            !response.ok
        ) {

            const data =
                await response
                    .json()
                    .catch(
                        () => ({})
                    );

            throw new Error(
                data.error ||
                "Unable to update task"
            );
        }

        await loadTasks();

        showToast(

            wasCompleted

                ? "Task moved back to active."

                : "Task completed successfully.",

            wasCompleted

                ? "info"

                : "success"
        );

    } catch (error) {

        console.error(
            error
        );

        showToast(

            error.message ||
            "Unable to update task.",

            "error"
        );
    }
}


/* =========================================================
   DELETE TASK
========================================================= */

async function deleteTask(
    id
) {

    const confirmed =
        await confirmDelete();

    if (
        !confirmed
    ) {
        return;
    }

    try {

        const response =
            await fetch(

                `/api/tasks/${id}`,

                {
                    method:
                        "DELETE"
                }
            );

        if (
            !response.ok
        ) {

            const data =
                await response
                    .json()
                    .catch(
                        () => ({})
                    );

            throw new Error(
                data.error ||
                "Unable to delete task"
            );
        }

        removeReminderConfig(
            id
        );

        await loadTasks();

        showToast(
            "Task deleted successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            error
        );

        showToast(

            error.message ||
            "Unable to delete task.",

            "error"
        );
    }
}


/* =========================================================
   DELETE CONFIRM
========================================================= */

function confirmDelete() {

    return new Promise(
        (resolve) => {

            const overlay =
                document.createElement(
                    "div"
                );

            overlay.className =
                "taskora-confirm-overlay";

            overlay.innerHTML = `

                <div class="taskora-confirm">

                    <div class="taskora-confirm-icon">
                        ×
                    </div>

                    <h3>
                        Delete Task?
                    </h3>

                    <p>
                        This task will be permanently removed from your planner.
                    </p>

                    <div class="confirm-actions">

                        <button
                            class="confirm-cancel"
                            type="button"
                        >
                            Cancel
                        </button>

                        <button
                            class="confirm-delete"
                            type="button"
                        >
                            Delete
                        </button>

                    </div>

                </div>

            `;

            document.body.appendChild(
                overlay
            );

            const done =
                (value) => {

                    overlay.remove();

                    resolve(
                        value
                    );
                };

            overlay
                .querySelector(
                    ".confirm-cancel"
                )
                .onclick =
                () =>
                    done(
                        false
                    );

            overlay
                .querySelector(
                    ".confirm-delete"
                )
                .onclick =
                () =>
                    done(
                        true
                    );

            overlay.onclick =
                (event) => {

                    if (
                        event.target ===
                        overlay
                    ) {

                        done(
                            false
                        );
                    }
                };
        }
    );
}


/* =========================================================
   STATS
========================================================= */

function updateStats(
    tasks
) {

    const total =
        tasks.length;

    const completed =
        tasks.filter(
            (task) =>
                task.completed ===
                1
        ).length;

    const high =
        tasks.filter(
            (task) =>
                task.completed ===
                    0

                &&

                task.priority_score >=
                    60
        ).length;

    const productivity =
        total

            ? Math.round(
                (
                    completed /
                    total
                )
                *
                100
            )

            : 0;

    setText(
        "totalTasks",
        total
    );

    setText(
        "completedTasks",
        completed
    );

    setText(
        "urgentTasks",
        high
    );

    setText(
        "productivity",
        `${productivity}%`
    );

    setText(
        "progressText",
        `${productivity}%`
    );

    const progressFill =
        document.getElementById(
            "progressFill"
        );

    if (
        progressFill
    ) {

        progressFill.style.width =
            `${productivity}%`;
    }

    const message =

        total === 0

            ? "Add your first task to start tracking progress."

            : productivity === 100

                ? "Excellent! All tasks are completed."

                : productivity >= 70

                    ? "Great progress. You're almost there."

                    : productivity >= 40

                        ? "Good momentum. Keep moving."

                        : "Complete tasks to build your momentum.";

    setText(
        "progressMessage",
        message
    );
}


/* =========================================================
   DEADLINE INSIGHTS
========================================================= */

function updateDeadlineInsights(
    tasks
) {

    const today =
        startOfToday();

    const active =
        tasks.filter(
            (task) =>
                task.completed ===
                    0
        );

    const dueToday =
        active.filter(
            (task) =>
                parseTaskDate(
                    task.deadline
                )
                    .getTime() ===
                today
                    .getTime()
        );

    const overdue =
        active.filter(
            (task) =>
                parseTaskDate(
                    task.deadline
                )
                <
                today
        );

    setText(
        "dueTodayCount",
        dueToday.length
    );

    setText(
        "overdueCount",
        overdue.length
    );

    setText(
        "remainingCount",
        active.length
    );

    const upcoming =
        active

            .filter(
                (task) =>
                    parseTaskDate(
                        task.deadline
                    )
                    >=
                    today
            )

            .sort(
                (a, b) =>
                    parseTaskDate(
                        a.deadline
                    )
                    -
                    parseTaskDate(
                        b.deadline
                    )
            );

    setText(

        "nextDeadline",

        upcoming.length

            ? `${upcoming[0].title} • ${formatDate(
                upcoming[0].deadline
            )}`

            : "No upcoming tasks"
    );
}


/* =========================================================
   SMART FOCUS
========================================================= */

function renderSmartFocus(
    tasks
) {

    const active =
        tasks.filter(
            (task) =>
                task.completed ===
                    0
        );

    const description =
        document.getElementById(
            "focusDescription"
        );

    const score =
        document.getElementById(
            "focusScore"
        );

    if (
        !description ||
        !score
    ) {
        return;
    }

    if (
        !active.length
    ) {

        description.textContent =
            "You're all caught up. Add a new task to continue.";

        score.textContent =
            "--";

        score.style.color =
            "";

        return;
    }

    const best =
        active.reduce(
            (
                first,
                second
            ) =>
                second.priority_score >
                first.priority_score

                    ? second

                    : first
        );

    const priority =
        getPriorityInfo(
            best.priority_score
        );

    description.innerHTML = `

        Start with

        <strong>
            ${escapeHTML(
                best.title
            )}
        </strong>.

        It currently has the highest priority
        and is classified as

        <strong
            style="color:${priority.color}"
        >
            ${priority.label}
        </strong>.

    `;

    score.textContent =
        best.priority_score;

    score.style.color =
        priority.color;
}


/* =========================================================
   SEARCH / FILTER
========================================================= */

function applyFilters() {

    const search =
        (
            searchInput?.value ||
            ""
        )
            .toLowerCase()
            .trim();

    let list =
        [
            ...allTasks
        ];

    if (
        currentFilter ===
        "active"
    ) {

        list =
            list.filter(
                (task) =>
                    task.completed ===
                        0
            );
    }

    if (
        currentFilter ===
        "completed"
    ) {

        list =
            list.filter(
                (task) =>
                    task.completed ===
                        1
            );
    }

    if (
        search
    ) {

        list =
            list.filter(
                (task) =>
                    task.title
                        .toLowerCase()
                        .includes(
                            search
                        )
            );
    }

    renderTasks(
        list
    );
}

searchInput
    ?.addEventListener(
        "input",
        applyFilters
    );

filterButtons.forEach(
    (button) => {

        button.addEventListener(
            "click",
            () => {

                filterButtons.forEach(
                    (item) =>
                        item.classList.remove(
                            "active"
                        )
                );

                button.classList.add(
                    "active"
                );

                currentFilter =
                    button.dataset.filter;

                applyFilters();
            }
        );
    }
);


/* =========================================================
   REMINDER STORAGE
========================================================= */

function loadReminderStore() {

    try {

        return JSON.parse(

            localStorage.getItem(
                REMINDER_STORAGE_KEY
            )

            ||

            "{}"
        );

    } catch {

        return {};
    }
}

function writeReminderStore(
    store
) {

    localStorage.setItem(

        REMINDER_STORAGE_KEY,

        JSON.stringify(
            store
        )
    );
}

function getReminderConfig(
    id
) {

    return (

        loadReminderStore()[
            String(
                id
            )
        ]

        ||

        null
    );
}

function saveReminderConfig(
    id,
    config
) {

    const store =
        loadReminderStore();

    const oldConfig =
        store[
            String(
                id
            )
        ]

        ||

        {};

    store[
        String(
            id
        )
    ] = {

        ...config,

        lastNotifiedKey:
            oldConfig.lastNotifiedKey ||
            ""
    };

    writeReminderStore(
        store
    );
}

function removeReminderConfig(
    id
) {

    const store =
        loadReminderStore();

    delete store[
        String(
            id
        )
    ];

    writeReminderStore(
        store
    );
}

function syncReminderStoreWithTasks(
    tasks
) {

    const store =
        loadReminderStore();

    const validIds =
        new Set(

            tasks.map(
                (task) =>
                    String(
                        task.id
                    )
            )
        );

    let changed =
        false;

    Object.keys(
        store
    )
        .forEach(
            (id) => {

                if (
                    !validIds.has(
                        id
                    )
                ) {

                    delete store[
                        id
                    ];

                    changed =
                        true;
                }
            }
        );

    if (
        changed
    ) {

        writeReminderStore(
            store
        );
    }
}


/* =========================================================
   REMINDER FORM
========================================================= */

function getReminderFormValues() {

    return {

        mode:
            reminderMode?.value ||
            "none",

        time:
            reminderTime?.value ||
            "18:00",

        customDays:
            Math.max(

                0,

                parseInt(
                    customDaysInput?.value ||
                    "2",
                    10
                )
                ||
                0
            ),

        voiceEnabled:
            Boolean(
                voiceEnabled?.checked
            ),

        language:
            voiceLanguage?.value ===
                "ar"

                ? "ar"

                : "en",

        voiceStyle:
            voiceStyle?.value ===
                "default"

                ? "default"

                : "premium"
    };
}

function setReminderFormValues(
    config = {}
) {

    if (
        reminderMode
    ) {

        const supportedModes =
            new Set(
                [
                    "smart",
                    "one_day",
                    "three_days",
                    "one_week",
                    "custom",
                    "none"
                ]
            );

        reminderMode.value =

            supportedModes.has(
                config.mode
            )

                ? config.mode

                : config.mode ===
                    "every_three_days"

                    ? "smart"

                    : "none";
    }

    if (
        reminderTime
    ) {

        reminderTime.value =
            config.time ||
            "18:00";
    }

    if (
        customDaysInput
    ) {

        customDaysInput.value =

            Number.isFinite(
                Number(
                    config.customDays
                )
            )

                ? Math.max(
                    0,
                    Number(
                        config.customDays
                    )
                )

                : 2;
    }

    if (
        voiceLanguage
    ) {

        voiceLanguage.value =

            config.language ===
                "ar"

                ? "ar"

                : "en";
    }

    if (
        voiceStyle
    ) {

        voiceStyle.value =

            config.voiceStyle ===
                "default"

                ? "default"

                : "premium";
    }

    if (
        voiceEnabled
    ) {

        voiceEnabled.checked =
            config.voiceEnabled !==
            false;
    }

    populateVoiceSelector();

    updateReminderControls();
}

function updateReminderControls() {

    const disabled =
        !reminderMode

        ||

        reminderMode.value ===
            "none";

    const isCustom =
        reminderMode?.value ===
            "custom";

    if (
        customDaysGroup
    ) {

        customDaysGroup.hidden =
            !isCustom;
    }

    if (
        customDaysInput
    ) {

        customDaysInput.disabled =
            disabled ||
            !isCustom;
    }

    [
        reminderTime,
        voiceLanguage,
        voiceStyle,
        voiceSelector,
        voiceEnabled,
        testVoiceBtn,
        requestNotificationBtn
    ]
        .forEach(
            (element) => {

                if (
                    element
                ) {

                    element.disabled =
                        disabled;
                }
            }
        );

    if (
        voiceStateText
    ) {

        voiceStateText.textContent =
            voiceEnabled?.checked

                ? "ON"

                : "OFF";
    }

    updateNotificationStatus();
}


/* =========================================================
   VOICE SYSTEM

   Desktop:
   Ryan / Hamdan first

   Mobile:
   fallback to any available voice
========================================================= */

function refreshVoices() {

    if (
        !(
            "speechSynthesis"
            in
            window
        )
    ) {

        availableVoices =
            [];

        return [];
    }

    availableVoices =
        window
            .speechSynthesis
            .getVoices()

        ||

        [];

    return availableVoices;
}

function getBestVoice(
    language
) {

    const voices =
        refreshVoices();

    if (
        !voices.length
    ) {

        return null;
    }


    /* =========================
       ARABIC
    ========================= */

    if (
        language ===
        "ar"
    ) {

        const hamdan =
            voices.find(
                (voice) => {

                    const name =
                        String(
                            voice.name ||
                            ""
                        )
                            .toLowerCase();

                    const lang =
                        String(
                            voice.lang ||
                            ""
                        )
                            .toLowerCase();

                    return (

                        (
                            name.includes(
                                "hamdan"
                            )

                            ||

                            name.includes(
                                "حمدان"
                            )
                        )

                        &&

                        lang.startsWith(
                            "ar"
                        )
                    );
                }
            );

        if (
            hamdan
        ) {

            return hamdan;
        }

        const anyArabic =
            voices.find(
                (voice) =>
                    String(
                        voice.lang ||
                        ""
                    )
                        .toLowerCase()
                        .startsWith(
                            "ar"
                        )
            );

        if (
            anyArabic
        ) {

            return anyArabic;
        }
    }


    /* =========================
       ENGLISH
    ========================= */

    else {

        const ryan =
            voices.find(
                (voice) => {

                    const name =
                        String(
                            voice.name ||
                            ""
                        )
                            .toLowerCase();

                    const lang =
                        String(
                            voice.lang ||
                            ""
                        )
                            .toLowerCase();

                    return (

                        name.includes(
                            "ryan"
                        )

                        &&

                        lang.startsWith(
                            "en"
                        )
                    );
                }
            );

        if (
            ryan
        ) {

            return ryan;
        }

        const anyEnglish =
            voices.find(
                (voice) =>
                    String(
                        voice.lang ||
                        ""
                    )
                        .toLowerCase()
                        .startsWith(
                            "en"
                        )
            );

        if (
            anyEnglish
        ) {

            return anyEnglish;
        }
    }


    /* =========================
       FINAL FALLBACK
    ========================= */

    return (
        voices[0] ||
        null
    );
}

function getVoiceLabel(
    language,
    voice
) {

    if (
        voice
    ) {

        return `${voice.name} (${voice.lang})`;
    }

    return language ===
        "ar"

        ? "Browser Arabic Voice"

        : "Browser English Voice";
}

function populateVoiceSelector() {

    if (
        !voiceSelector
    ) {

        return;
    }

    const language =
        voiceLanguage?.value ===
            "ar"

            ? "ar"

            : "en";

    const voice =
        getBestVoice(
            language
        );

    voiceSelector.innerHTML =
        "";

    const option =
        document.createElement(
            "option"
        );

    option.value =
        voice?.name ||
        "browser-default";

    option.textContent =
        getVoiceLabel(
            language,
            voice
        );

    voiceSelector.appendChild(
        option
    );

    voiceSelector.value =
        option.value;
}


/* =========================================================
   SPEECH
========================================================= */

function speakReminder(

    message,

    language = "en",

    cancelCurrent = false,

    style = "premium"

) {

    if (

        !(
            "speechSynthesis"
            in
            window
        )

        ||

        !(
            "SpeechSynthesisUtterance"
            in
            window
        )

    ) {

        showToast(
            "Voice is not supported in this browser.",
            "warning"
        );

        return false;
    }

    if (
        cancelCurrent
    ) {

        window
            .speechSynthesis
            .cancel();
    }

    const selectedVoice =
        getBestVoice(
            language
        );

    const speech =
        new SpeechSynthesisUtterance(
            message
        );


    /* =====================================================
       IF VOICE EXISTS
    ===================================================== */

    if (
        selectedVoice
    ) {

        speech.voice =
            selectedVoice;

        speech.lang =
            selectedVoice.lang

            ||

            (
                language ===
                    "ar"

                    ? "ar-SA"

                    : "en-US"
            );
    }


    /* =====================================================
       MOBILE FALLBACK

       If getVoices() is empty,
       Android / iPhone browser picks its default.
    ===================================================== */

    else {

        speech.lang =

            language ===
                "ar"

                ? "ar-SA"

                : "en-US";
    }


    speech.rate =
        style ===
            "premium"

            ? 0.92

            : 1;

    speech.pitch =
        style ===
            "premium"

            ? 0.95

            : 1;

    speech.volume =
        1;


    speech.onerror =
        (event) => {

            console.warn(
                "Taskora speech error:",
                event.error
            );
        };


    window
        .speechSynthesis
        .speak(
            speech
        );

    return true;
}


/* =========================================================
   REMINDER BADGE
========================================================= */

function renderReminderBadge(
    id
) {

    const config =
        getReminderConfig(
            id
        );

    if (

        !config

        ||

        config.mode ===
            "none"

    ) {

        return "";
    }

    const labels = {

        smart:
            "Smart Reminder",

        one_day:
            "1 Day Before",

        three_days:
            "3 Days Before",

        one_week:
            "1 Week Before",

        custom:
            `${
                Math.max(
                    0,
                    Number(
                        config.customDays
                    )
                    ||
                    0
                )
            } Day${
                Number(
                    config.customDays
                ) ===
                1

                    ? ""

                    : "s"
            } Before`
    };

    const label =
        labels[
            config.mode
        ]

        ||

        "Reminder";

    return `

        <span class="task-reminder-badge">

            🔔 ${label}

            •

            ${
                escapeHTML(
                    config.time ||
                    "18:00"
                )
            }

            ${
                config.voiceEnabled

                    ? "• 🔊"

                    : ""
            }

        </span>

    `;
}


/* =========================================================
   REMINDER TIME
========================================================= */

function dateKey(
    date
) {

    return (

        `${date.getFullYear()}-`

        +

        `${String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        )}-`

        +

        `${String(
            date.getDate()
        ).padStart(
            2,
            "0"
        )}`
    );
}

function timeKey(
    date
) {

    return (

        `${String(
            date.getHours()
        ).padStart(
            2,
            "0"
        )}:`

        +

        `${String(
            date.getMinutes()
        ).padStart(
            2,
            "0"
        )}`
    );
}

function daysLeft(
    deadline
) {

    return Math.round(

        (
            parseTaskDate(
                deadline
            )

            -

            startOfToday()
        )

        /

        86400000
    );
}

function shouldTrigger(

    mode,

    days,

    customDays = 0

) {

    if (

        mode ===
            "none"

        ||

        days ===
            null

    ) {

        return false;
    }

    if (
        mode ===
        "smart"
    ) {

        return (

            days === 7

            ||

            days === 3

            ||

            days === 1

            ||

            days === 0
        );
    }

    if (
        mode ===
        "one_day"
    ) {

        return (
            days ===
            1
        );
    }

    if (
        mode ===
        "three_days"
    ) {

        return (
            days ===
            3
        );
    }

    if (
        mode ===
        "one_week"
    ) {

        return (
            days ===
            7
        );
    }

    if (
        mode ===
        "custom"
    ) {

        return (

            days ===

            Math.max(
                0,
                Number(
                    customDays
                )
                ||
                0
            )
        );
    }

    return false;
}


/* =========================================================
   REMINDER MESSAGE
========================================================= */

function buildReminderMessage(

    task,

    days,

    language

) {

    const name =
        task.title

        ||

        (
            language ===
                "ar"

                ? "مهمتك"

                : "your task"
        );


    /* =====================================================
       ARABIC
    ===================================================== */

    if (
        language ===
        "ar"
    ) {

        if (
            days >
            0
        ) {

            let daysText;

            if (
                days ===
                1
            ) {

                daysText =
                    "يوم واحد";
            }

            else if (
                days ===
                7
            ) {

                daysText =
                    "أسبوع";
            }

            else if (
                days ===
                3
            ) {

                daysText =
                    "ثلاثة أيام";
            }

            else {

                daysText =
                    `${days} أيام`;
            }

            return (

                `باقي ${daysText} على مهمة ${name}. `

                +

                `خطوة بسيطة اليوم بتسهّل عليك الكثير.`
            );
        }

        if (
            days ===
            0
        ) {

            return (

                `موعد مهمة ${name} اليوم. `

                +

                `ركّز عليها وأنجزها بأفضل شكل.`
            );
        }

        return (

            `مهمة ${name} ما زالت بانتظارك. `

            +

            `رتّب وقتك وارجع أنجزها.`
        );
    }


    /* =====================================================
       ENGLISH
    ===================================================== */

    if (
        days >
        0
    ) {

        const timeText =

            days ===
                1

                ? "1 day"

                : days ===
                    7

                    ? "1 week"

                    : `${days} days`;

        return (

            `You have ${name} coming up in ${timeText}. `

            +

            `A little progress today will make things easier.`
        );
    }

    if (
        days ===
        0
    ) {

        return (

            `${name} is due today. `

            +

            `Stay focused and give it your best.`
        );
    }

    return (

        `${name} is still waiting. `

        +

        `Take a moment and get it back on track.`
    );
}


/* =========================================================
   BROWSER NOTIFICATIONS
========================================================= */

async function enableTaskoraNotifications() {

    if (
        !(
            "Notification"
            in
            window
        )
    ) {

        showToast(
            "Browser notifications are not supported.",
            "warning"
        );

        return;
    }

    if (
        !window.isSecureContext
    ) {

        showToast(
            "Notifications require HTTPS or localhost. Voice still works.",
            "warning"
        );

        return;
    }

    if (
        Notification.permission ===
        "granted"
    ) {

        showToast(
            "Notifications are already enabled.",
            "success"
        );

        return;
    }

    if (
        Notification.permission ===
        "denied"
    ) {

        showToast(
            "Notifications are blocked in browser settings.",
            "warning"
        );

        return;
    }

    const permission =
        await Notification
            .requestPermission();

    updateNotificationStatus();

    showToast(

        permission ===
            "granted"

            ? "Notifications enabled."

            : "Notification permission was not enabled.",

        permission ===
            "granted"

            ? "success"

            : "warning"
    );
}

function updateNotificationStatus() {

    if (
        !notificationStatus
    ) {

        return;
    }

    if (
        !(
            "Notification"
            in
            window
        )
    ) {

        notificationStatus.textContent =
            "Browser alerts are unavailable. Voice reminder still works while the planner is open.";

        return;
    }

    if (
        !window.isSecureContext
    ) {

        notificationStatus.textContent =
            "Voice works here. Browser notifications require localhost or HTTPS.";

        return;
    }

    if (
        Notification.permission ===
        "granted"
    ) {

        notificationStatus.textContent =
            "Notifications enabled ✓ Voice reminder is ready.";

        return;
    }

    if (
        Notification.permission ===
        "denied"
    ) {

        notificationStatus.textContent =
            "Browser notifications are blocked. Voice reminder can still work.";

        return;
    }

    notificationStatus.textContent =
        "Press Enable Notifications for browser alerts. Voice works while the planner is open.";
}

function showTaskNotification(

    task,

    message,

    days

) {

    if (

        !(
            "Notification"
            in
            window
        )

        ||

        !window.isSecureContext

        ||

        Notification.permission !==
            "granted"

    ) {

        return;
    }

    const title =

        days <
        0

            ? "Overdue"

            : days ===
                0

                ? "Due Today"

                : "Reminder";

    new Notification(

        title,

        {
            body:
                message,

            tag:
                `taskora-task-${task.id}`,

            renotify:
                true
        }
    );
}


/* =========================================================
   CHECK REMINDERS
========================================================= */

function checkTaskoraReminders() {

    if (
        !allTasks.length
    ) {

        return;
    }

    const now =
        new Date();

    const today =
        dateKey(
            now
        );

    const currentTime =
        timeKey(
            now
        );

    allTasks.forEach(
        (task) => {

            if (
                task.completed ===
                1
            ) {

                return;
            }

            const config =
                getReminderConfig(
                    task.id
                );

            if (

                !config

                ||

                config.mode ===
                    "none"

            ) {

                return;
            }

            if (

                currentTime <

                (
                    config.time ||
                    "18:00"
                )

            ) {

                return;
            }

            const days =
                daysLeft(
                    task.deadline
                );

            if (

                !shouldTrigger(
                    config.mode,
                    days,
                    config.customDays
                )

            ) {

                return;
            }

            const notificationKey =
                [
                    task.id,
                    today,
                    config.mode,
                    config.time,
                    config.customDays ?? "",
                    days
                ]
                    .join(
                        "|"
                    );

            if (
                config.lastNotifiedKey ===
                notificationKey
            ) {

                return;
            }

            const message =
                buildReminderMessage(
                    task,
                    days,
                    config.language
                );

            showToast(

                message,

                days <
                0

                    ? "warning"

                    : "info"
            );

            showTaskNotification(
                task,
                message,
                days
            );

            if (
                config.voiceEnabled
            ) {

                speakReminder(
                    message,
                    config.language,
                    false,
                    config.voiceStyle ||
                    "premium"
                );
            }

            const store =
                loadReminderStore();

            if (
                store[
                    String(
                        task.id
                    )
                ]
            ) {

                store[
                    String(
                        task.id
                    )
                ]
                    .lastNotifiedKey =
                    notificationKey;

                writeReminderStore(
                    store
                );
            }
        }
    );
}


/* =========================================================
   REMINDER EVENTS
========================================================= */

reminderMode
    ?.addEventListener(
        "change",
        updateReminderControls
    );

voiceEnabled
    ?.addEventListener(
        "change",
        updateReminderControls
    );

voiceLanguage
    ?.addEventListener(
        "change",
        () => {

            populateVoiceSelector();

            updateReminderControls();
        }
    );

voiceStyle
    ?.addEventListener(
        "change",
        populateVoiceSelector
    );

requestNotificationBtn
    ?.addEventListener(
        "click",
        enableTaskoraNotifications
    );


/* =========================================================
   TEST VOICE
========================================================= */

testVoiceBtn
    ?.addEventListener(
        "click",
        () => {

            const language =

                voiceLanguage?.value ===
                    "ar"

                    ? "ar"

                    : "en";

            const title =
                document
                    .getElementById(
                        "title"
                    )
                    .value
                    .trim();

            const name =

                title

                ||

                (
                    language ===
                        "ar"

                        ? "مهمتك"

                        : "your task"
                );

            const mode =
                reminderMode?.value ||
                "smart";


            /* =====================================================
               NO REMINDER
            ===================================================== */

            if (
                mode ===
                "none"
            ) {

                showToast(

                    language ===
                        "ar"

                        ? "اختر نوع تذكير أولاً."

                        : "Choose a reminder type first.",

                    "warning"
                );

                return;
            }


            /* =====================================================
               SMART REMINDER
            ===================================================== */

            if (
                mode ===
                "smart"
            ) {

                const smartMessage =

                    language ===
                        "ar"

                        ? (

                            `تم تفعيل التذكير الذكي لمهمة ${name}. `

                            +

                            `سيتم تذكيرك قبل أسبوع، وقبل ثلاثة أيام، وقبل يوم واحد، وفي يوم التسليم.`
                        )

                        : (

                            `Smart reminder is active for ${name}. `

                            +

                            `You will be reminded one week before, three days before, one day before, and on the due date.`
                        );

                speakReminder(

                    smartMessage,

                    language,

                    true,

                    voiceStyle?.value ||
                    "premium"
                );

                showToast(

                    language ===
                        "ar"

                        ? "يتم اختبار التذكير الذكي."

                        : "Testing smart reminder.",

                    "info"
                );

                return;
            }


            /* =====================================================
               SELECTED REMINDER MODE
            ===================================================== */

            let testDays =
                3;

            if (
                mode ===
                "one_day"
            ) {

                testDays =
                    1;
            }

            else if (
                mode ===
                "three_days"
            ) {

                testDays =
                    3;
            }

            else if (
                mode ===
                "one_week"
            ) {

                testDays =
                    7;
            }

            else if (
                mode ===
                "custom"
            ) {

                testDays =
                    Math.max(

                        0,

                        Number(
                            customDaysInput?.value
                        )

                        ||

                        0
                    );
            }

            const message =
                buildReminderMessage(

                    {
                        title:
                            name
                    },

                    testDays,

                    language
                );

            speakReminder(

                message,

                language,

                true,

                voiceStyle?.value ||
                "premium"
            );

            showToast(

                language ===
                    "ar"

                    ? "يتم اختبار صوت التذكير."

                    : "Testing reminder voice.",

                "info"
            );
        }
    );


/* =========================================================
   LOAD VOICES
========================================================= */

if (
    "speechSynthesis"
    in
    window
) {

    window
        .speechSynthesis
        .addEventListener(

            "voiceschanged",

            populateVoiceSelector
        );

    setTimeout(

        populateVoiceSelector,

        300
    );

    setTimeout(

        populateVoiceSelector,

        1000
    );
}

populateVoiceSelector();


/* =========================================================
   AUTO REMINDER CHECKS
========================================================= */

window.addEventListener(

    "focus",

    checkTaskoraReminders
);

document.addEventListener(

    "visibilitychange",

    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            populateVoiceSelector();

            checkTaskoraReminders();
        }
    }
);

setInterval(

    checkTaskoraReminders,

    30000
);


/* =========================================================
   NAVIGATION
========================================================= */

function setActiveNav(
    target
) {

    navItems.forEach(
        (item) => {

            item.classList.toggle(

                "active",

                item.dataset.target ===
                target
            );
        }
    );
}

function scrollToSection(
    target
) {

    setActiveNav(
        target
    );

    if (
        target ===
        "dashboard"
    ) {

        window.scrollTo(
            {
                top:
                    0,

                behavior:
                    "smooth"
            }
        );

        return;
    }

    if (
        target ===
        "tasks"
    ) {

        tasksSection
            ?.scrollIntoView(
                {
                    behavior:
                        "smooth",

                    block:
                        "start"
                }
            );

        return;
    }

    if (
        target ===
        "priority"
    ) {

        prioritySection
            ?.scrollIntoView(
                {
                    behavior:
                        "smooth",

                    block:
                        "center"
                }
            );
    }
}

navItems.forEach(
    (item) => {

        item.addEventListener(

            "click",

            () => {

                scrollToSection(
                    item.dataset.target
                );
            }
        );
    }
);


/* =========================================================
   START
========================================================= */

updateReminderControls();

updateNotificationStatus();

loadTasks();