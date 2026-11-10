"use strict";

/* ========================================
   DOM Helper and Configuration
======================================== */

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "campus-student-profiles-v1";
const PAGE_SIZE = 7;

const PROGRAMS = {
    BSIT: "Information Technology",
    BSCS: "Computer Science",
    BSIS: "Information Systems",
    ACT: "Associate in Computer Technology"
};

const fields = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "address",
    "studentId",
    "program",
    "year",
    "section",
    "status"
];

/* ========================================
   Sample Student Data
======================================== */

const names = [
    ["Althea", "Santos", "BSIT", "2", "A"],
    ["Gabriel", "Reyes", "BSCS", "3", "A"],
    ["Isabella", "Cruz", "BSIS", "1", "B"],
    ["Miguel", "Dela Rosa", "BSIT", "4", "A"],
    ["Sofia", "Garcia", "BSCS", "2", "A"],
    ["Nathan", "Mendoza", "BSIT", "1", "B"],
    ["Chloe", "Ramos", "BSIS", "3", "A"],
    ["Ethan", "Torres", "BSCS", "4", "A"],
    ["Andrea", "Flores", "BSIT", "2", "B"],
    ["Liam", "Castillo", "BSIS", "1", "A"],
    ["Jasmine", "Navarro", "BSCS", "3", "B"],
    ["Daniel", "Aquino", "BSIT", "4", "B"]
];

function seedStudents() {
    return names.map((student, index) => ({
        key: `demo-${index}`,
        firstName: student[0],
        lastName: student[1],

        email:
            student[0].toLowerCase() +
            "." +
            student[1].replaceAll(" ", "").toLowerCase() +
            "@example.com",

        phone: "",
        address: "Botolan, Zambales",

        studentId:
            "2026-" + String(index + 1).padStart(5, "0"),

        program: student[2],
        year: student[3],
        section: student[4],

        status:
            index === 4 || index === 9
                ? "Inactive"
                : "Active",

        createdAt: new Date().toISOString()
    }));
}

/* ========================================
   Storage Validation and Initialization
======================================== */

function validRecord(student) {
    return (
        student &&
        typeof student.key === "string" &&

        fields.every(
            (field) => typeof student[field] === "string"
        ) &&

        Object.hasOwn(PROGRAMS, student.program) &&

        ["1", "2", "3", "4"].includes(student.year) &&

        ["Active", "Inactive"].includes(student.status) &&

        typeof student.createdAt === "string"
    );
}

let students;
let storageWarning = "";

try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === null) {
        students = seedStudents();

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(students)
        );
    } else {
        const parsed = JSON.parse(stored);

        if (
            !Array.isArray(parsed) ||
            !parsed.every(validRecord)
        ) {
            throw new Error("Invalid data");
        }

        students = parsed;
    }
} catch {
    students = seedStudents();

    storageWarning =
        "Browser storage is unavailable or invalid. " +
        "Sample records are loaded; changes may last only for this visit.";
}

/* ========================================
   Application State
======================================== */

let tab = "all";
let page = 1;
let ascending = null;
let selectedKey = null;

/* ========================================
   Bootstrap Components
======================================== */

const modal = new bootstrap.Modal(
    $("studentModal")
);

const drawer = new bootstrap.Offcanvas(
    $("profileDrawer")
);

const toast = new bootstrap.Toast(
    $("feedbackToast"),
    {
        delay: 4500
    }
);

/* ========================================
   Shared Utility Functions
======================================== */

function notify(message) {
    $("toastMessage").textContent = message;
    toast.show();
}

/*
 * Escape user-controlled values before inserting
 * them into an HTML template.
 */
function esc(value) {
    const characters = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    return String(value).replace(
        /[&<>"']/g,
        (character) => characters[character]
    );
}

function initials(student) {
    return esc(
        (student.firstName[0] || "") +
        (student.lastName[0] || "")
    );
}

function badge(student) {
    const inactiveClass =
        student.status === "Inactive"
            ? "inactive"
            : "";

    return `
        <span class="status-badge ${inactiveClass}">
            ${esc(student.status)}
        </span>
    `;
}

function persist() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(students)
        );

        return true;
    } catch {
        return false;
    }
}

/* ========================================
   Search, Filtering, and Sorting
======================================== */

function filtered() {
    const query = $("search")
        .value
        .trim()
        .toLowerCase();

    let list = students.filter((student) => {
        const matchesStatus =
            tab === "all" ||
            student.status === tab;

        const matchesProgram =
            !$("programFilter").value ||
            student.program === $("programFilter").value;

        const matchesYear =
            !$("yearFilter").value ||
            student.year === $("yearFilter").value;

        const searchableText = [
            student.firstName,
            student.lastName,
            student.studentId,
            student.email
        ]
            .join(" ")
            .toLowerCase();

        const matchesSearch =
            searchableText.includes(query);

        return (
            matchesStatus &&
            matchesProgram &&
            matchesYear &&
            matchesSearch
        );
    });

    if (ascending !== null) {
        list.sort((first, second) => {
            const firstName =
                `${first.firstName} ${first.lastName}`;

            const secondName =
                `${second.firstName} ${second.lastName}`;

            return (
                firstName.localeCompare(secondName) *
                (ascending ? 1 : -1)
            );
        });
    }

    return list;
}

function updateTabs() {
    document
        .querySelectorAll("[data-tab]")
        .forEach((button) => {
            const isActive =
                button.dataset.tab === tab;

            button.classList.toggle(
                "active",
                isActive
            );

            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );
        });
}

function resetFilters() {
    tab = "all";
    page = 1;

    $("search").value = "";
    $("programFilter").value = "";
    $("yearFilter").value = "";

    updateTabs();
    render();
}

/* ========================================
   Render Directory and Statistics
======================================== */

function render() {
    const list = filtered();

    const pages = Math.max(
        1,
        Math.ceil(list.length / PAGE_SIZE)
    );

    page = Math.min(page, pages);

    /* Summary Counts */

    $("totalStat").textContent = students.length;

    $("activeStat").textContent = students.filter(
        (student) => student.status === "Active"
    ).length;

    $("navCount").textContent = students.length;
    $("allCount").textContent = students.length;

    const now = new Date();

    $("newStat").textContent = students.filter(
        (student) => {
            const createdDate = new Date(
                student.createdAt
            );

            return (
                createdDate.getFullYear() === now.getFullYear() &&
                createdDate.getMonth() === now.getMonth()
            );
        }
    ).length;

    /* Current Page Records */

    const startIndex = (page - 1) * PAGE_SIZE;
    const endIndex = page * PAGE_SIZE;

    const pageStudents = list.slice(
        startIndex,
        endIndex
    );

    const yearSuffixes = [
        "",
        "st",
        "nd",
        "rd",
        "th"
    ];

    $("studentRows").innerHTML = pageStudents
        .map((student) => {
            const yearSuffix =
                yearSuffixes[Number(student.year)];

            return `
                <tr>
                    <td>
                        <div class="student-identity">
                            <span
                                class="avatar"
                                aria-hidden="true"
                            >
                                ${initials(student)}
                            </span>

                            <div>
                                <strong>
                                    ${esc(student.firstName)}
                                    ${esc(student.lastName)}
                                </strong>

                                <small>
                                    ${esc(student.email)}
                                </small>
                            </div>
                        </div>
                    </td>

                    <td>
                        ${esc(student.studentId)}
                    </td>

                    <td>
                        <span
                            class="program-chip program-${student.program}"
                        >
                            ${student.program}
                        </span>
                    </td>

                    <td>
                        ${student.year}${yearSuffix} Year ·
                        ${esc(student.section)}
                    </td>

                    <td>
                        ${badge(student)}
                    </td>

                    <td class="text-end">
                        <button
                            class="view-btn"
                            data-key="${esc(student.key)}"
                            aria-label="View ${esc(student.firstName)} ${esc(student.lastName)}"
                        >
                            View
                            <span aria-hidden="true">↗</span>
                        </button>
                    </td>
                </tr>
            `;
        })
        .join("");

    /* Empty State and Pagination */

    $("emptyState").hidden = list.length > 0;

    if (list.length > 0) {
        const firstVisible = startIndex + 1;

        const lastVisible = Math.min(
            endIndex,
            list.length
        );

        $("resultCount").textContent =
            `Showing ${firstVisible}–${lastVisible} ` +
            `of ${list.length} students`;
    } else {
        $("resultCount").textContent =
            "Showing 0 students";
    }

    $("pageLabel").textContent =
        `${page} / ${pages}`;

    $("prevPage").disabled = page === 1;
    $("nextPage").disabled = page >= pages;

    /* Program Insights */

    $("programBars").innerHTML = Object
        .entries(PROGRAMS)
        .map(([code, label]) => {
            const count = students.filter(
                (student) => student.program === code
            ).length;

            const percentage = students.length
                ? Math.round(
                    (count / students.length) * 100
                )
                : 0;

            return `
                <div class="program-bar">
                    <div>
                        <strong>
                            ${code} — ${label}
                        </strong>

                        <span>
                            ${count} students · ${percentage}%
                        </span>
                    </div>

                    <div class="bar-track">
                        <div
                            class="bar-fill ${code}"
                            style="width: ${percentage}%"
                            role="img"
                            aria-label="${code}: ${count} students, ${percentage} percent"
                        ></div>
                    </div>
                </div>
            `;
        })
        .join("");
}

/* ========================================
   Add / Edit Student Form
======================================== */

function openForm(student = null) {
    $("studentForm").reset();
    $("formError").hidden = true;

    $("recordKey").value = student
        ? student.key
        : "";

    $("formTitle").textContent = student
        ? "Edit student"
        : "Add a student";

    fields.forEach((field) => {
        if (student) {
            $(field).value = student[field];
        }
    });

    modal.show();
}

$("studentModal").addEventListener(
    "shown.bs.modal",
    () => {
        $("firstName").focus();
    }
);

$("addBtn").addEventListener(
    "click",
    () => {
        openForm();
    }
);

$("studentForm").addEventListener(
    "submit",
    (event) => {
        event.preventDefault();

        /* Collect Form Values */

        const data = Object.fromEntries(
            fields.map((field) => [
                field,
                $(field).value.trim()
            ])
        );

        const key = $("recordKey").value;

        /* Validate Required and Unique Values */

        let error = "";

        const missingRequiredField = [
            "firstName",
            "lastName",
            "studentId",
            "section"
        ].some((field) => !data[field]);

        const duplicateStudentId = students.some(
            (student) =>
                student.key !== key &&
                student.studentId.toLowerCase() ===
                    data.studentId.toLowerCase()
        );

        const duplicateEmail = students.some(
            (student) =>
                student.key !== key &&
                student.email.toLowerCase() ===
                    data.email.toLowerCase()
        );

        if (missingRequiredField) {
            error = "Please complete all required fields.";
        } else if (duplicateStudentId) {
            error = "This student ID is already in use.";
        } else if (duplicateEmail) {
            error = "This email address is already in use.";
        }

        if (error) {
            $("formError").textContent = error;
            $("formError").hidden = false;

            return;
        }

        /* Create or Update the Record */

        const previous = students.find(
            (student) => student.key === key
        );

        const record = {
            ...data,

            key: previous
                ? key
                : crypto.randomUUID(),

            createdAt: previous
                ? previous.createdAt
                : new Date().toISOString()
        };

        if (previous) {
            students = students.map((student) =>
                student.key === key
                    ? record
                    : student
            );
        } else {
            students.unshift(record);
        }

        /* Save and Refresh */

        const saved = persist();

        resetFilters();
        modal.hide();

        if (saved) {
            notify(
                previous
                    ? "Student profile updated."
                    : "Student profile added."
            );
        } else {
            notify(
                "Profile updated for this visit. " +
                "Browser storage could not be saved."
            );
        }
    }
);

/* ========================================
   Student Profile Drawer
======================================== */

function showProfile(key) {
    const student = students.find(
        (record) => record.key === key
    );

    if (!student) {
        return;
    }

    selectedKey = key;

    const detail = (label, value) => `
        <dt>${label}</dt>
        <dd>${esc(value || "Not provided")}</dd>
    `;

    const dateAdded = new Date(
        student.createdAt
    ).toLocaleDateString(
        undefined,
        {
            month: "long",
            day: "numeric",
            year: "numeric"
        }
    );

    $("profileContent").innerHTML = `
        <div class="profile-hero">
            <span class="avatar">
                ${initials(student)}
            </span>

            <h2 id="profileTitle">
                ${esc(student.firstName)}
                ${esc(student.lastName)}
            </h2>

            <p>${esc(student.studentId)}</p>

            ${badge(student)}
        </div>

        <section class="profile-section">
            <h3>ACADEMIC INFORMATION</h3>

            <dl>
                ${detail(
                    "Program",
                    student.program +
                    " — " +
                    PROGRAMS[student.program]
                )}

                ${detail(
                    "Year & section",
                    "Year " +
                    student.year +
                    " · " +
                    student.section
                )}
            </dl>
        </section>

        <section class="profile-section">
            <h3>CONTACT INFORMATION</h3>

            <dl>
                ${detail("Email", student.email)}
                ${detail("Phone", student.phone)}
                ${detail("Address", student.address)}
            </dl>
        </section>

        <section class="profile-section">
            <h3>PROFILE DETAILS</h3>

            <dl>
                ${detail("Date added", dateAdded)}
            </dl>
        </section>

        <div class="profile-actions">
            <button
                class="btn btn-primary"
                id="editProfile"
            >
                Edit profile
            </button>

            <button
                class="btn btn-delete"
                id="deleteProfile"
            >
                Delete student
            </button>
        </div>

        <div
            id="deleteConfirm"
            class="alert alert-light mt-3"
            hidden
        >
            <p class="small">
                Delete this student profile from this browser?
            </p>

            <button
                class="btn btn-danger"
                id="confirmDelete"
            >
                Yes, delete
            </button>

            <button
                class="btn btn-light"
                id="cancelDelete"
            >
                Cancel
            </button>
        </div>
    `;

    /* Open Edit Form After Closing Drawer */

    $("editProfile").onclick = () => {
        const current = students.find(
            (record) => record.key === selectedKey
        );

        $("profileDrawer").addEventListener(
            "hidden.bs.offcanvas",
            () => {
                openForm(current);
            },
            {
                once: true
            }
        );

        drawer.hide();
    };

    /* Show Delete Confirmation */

    $("deleteProfile").onclick = () => {
        $("deleteConfirm").hidden = false;
        $("confirmDelete").focus();
    };

    /* Cancel Deletion */

    $("cancelDelete").onclick = () => {
        $("deleteConfirm").hidden = true;
        $("deleteProfile").focus();
    };

    /* Confirm Deletion */

    $("confirmDelete").onclick = () => {
        students = students.filter(
            (record) => record.key !== selectedKey
        );

        const saved = persist();

        drawer.hide();
        render();

        notify(
            saved
                ? "Student profile deleted."
                : "Deleted for this visit. " +
                  "Browser storage could not be saved."
        );
    };

    drawer.show();
}

/* ========================================
   Directory Event Handlers
======================================== */

/* View Profile: Event Delegation */

$("studentRows").onclick = (event) => {
    const button = event.target.closest(
        "[data-key]"
    );

    if (button) {
        showProfile(button.dataset.key);
    }
};

/* Search and Dropdown Filters */

[
    "search",
    "programFilter",
    "yearFilter"
].forEach((id) => {
    const eventName = id === "search"
        ? "input"
        : "change";

    $(id).addEventListener(
        eventName,
        () => {
            page = 1;
            render();
        }
    );
});

/* Status Tabs */

document
    .querySelectorAll("[data-tab]")
    .forEach((button) => {
        button.onclick = () => {
            tab = button.dataset.tab;
            page = 1;

            updateTabs();
            render();
        };
    });

/* Clear Filters */

$("clearFilters").onclick = resetFilters;
$("emptyClear").onclick = resetFilters;

/* Pagination */

$("prevPage").onclick = () => {
    page--;
    render();
};

$("nextPage").onclick = () => {
    page++;
    render();
};

/* Sort Students by Name */

$("sortName").onclick = () => {
    ascending = ascending === null
        ? true
        : !ascending;

    page = 1;

    render();

    $("sortName").textContent =
        "STUDENT " + (ascending ? "↑" : "↓");
};

/* ========================================
   Navigation
======================================== */

function showSection(insights) {
    $("directorySection").hidden = insights;
    $("insightsSection").hidden = !insights;

    $("directoryNav").classList.toggle(
        "active",
        !insights
    );

    $("insightsNav").classList.toggle(
        "active",
        insights
    );

    $("pageTitle").innerHTML = insights
        ? "Program insights<span>.</span>"
        : "Student directory<span>.</span>";

    $("breadcrumb").textContent = insights
        ? "Program insights"
        : "Student directory";

    $("pageDescription").textContent = insights
        ? "A clearer picture of your student community."
        : "Know your students. Support their next chapter.";

    $("sidebar").classList.remove("open");

    $("menuToggle").setAttribute(
        "aria-expanded",
        "false"
    );
}

$("directoryNav").onclick = () => {
    showSection(false);
};

$("insightsNav").onclick = () => {
    showSection(true);
};

/* Mobile Sidebar Toggle */

$("menuToggle").onclick = () => {
    const open = $("sidebar")
        .classList
        .toggle("open");

    $("menuToggle").setAttribute(
        "aria-expanded",
        String(open)
    );
};

/* ========================================
   Keyboard Shortcuts
======================================== */

document.addEventListener(
    "keydown",
    (event) => {
        /* Escape: Close Mobile Sidebar */

        if (event.key === "Escape") {
            $("sidebar").classList.remove("open");

            $("menuToggle").setAttribute(
                "aria-expanded",
                "false"
            );
        }

        /* Slash: Focus Student Search */

        const isTyping = [
            "INPUT",
            "TEXTAREA",
            "SELECT"
        ].includes(
            document.activeElement.tagName
        );

        const overlayOpen = document.querySelector(
            ".modal.show, .offcanvas.show"
        );

        if (
            event.key === "/" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !isTyping &&
            !overlayOpen
        ) {
            event.preventDefault();

            showSection(false);
            $("search").focus();
        }
    }
);

/* ========================================
   CSV Export
======================================== */

/*
 * Quote CSV values and neutralize spreadsheet
 * formula prefixes in user-provided data.
 */
function csvCell(value) {
    let text = String(value ?? "");

    if (/^[\s]*[=+@\-]/.test(text)) {
        text = "'" + text;
    }

    return '"' + text.replaceAll('"', '""') + '"';
}

$("exportBtn").onclick = () => {
    const list = $("insightsSection").hidden
        ? filtered()
        : students;

    if (!list.length) {
        notify("There are no students to export.");
        return;
    }

    const rows = [
        fields,

        ...list.map((student) =>
            fields.map((field) => student[field])
        )
    ];

    const csv = rows
        .map((row) =>
            row.map(csvCell).join(",")
        )
        .join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        {
            type: "text/csv;charset=utf-8;"
        }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "campus-students.csv";

    document.body.append(link);

    link.click();
    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);

    notify(
        `Exported ${list.length} student profiles.`
    );
};

/* ========================================
   Start Application
======================================== */

render();

if (storageWarning) {
    notify(storageWarning);
}