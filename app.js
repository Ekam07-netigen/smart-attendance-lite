const STORAGE_KEYS = {
  settings: "sal_settings_v2",
  courses: "sal_courses_v2",
  rosters: "sal_rosters_v2",
  sessions: "sal_sessions_v2",
  activeSession: "sal_active_session_v2",
  attendance: "sal_attendance_v2",
  pendingPosts: "sal_pending_posts_v2",
  uiMode: "sal_ui_mode_v1",
  // legacy:
  legacyActiveSession: "sal_active_session_v1",
  legacyAttendance: "sal_attendance_v1",
};

const SESSION_UNLOCK_KEY = "sal_teacher_unlocked_v1"; // sessionStorage
const DEFAULT_GEOFENCE_M = 150;
const DEFAULT_DEFAULTER_THRESHOLD = 75;

function uid() {
  return (crypto?.randomUUID?.() || `id_${Math.random().toString(16).slice(2)}_${Date.now()}`);
}

function nowIso() {
  return new Date().toISOString();
}

function formatLocal(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function randomCode6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMsg(text, kind = "muted") {
  const el = document.getElementById("checkInMsg");
  el.textContent = text;
  el.className = `small ${kind === "ok" ? "ok" : kind === "err" ? "err" : "muted"}`;
}

function setPinMsg(text, kind = "muted") {
  const el = document.getElementById("pinMsg");
  el.textContent = text;
  el.className = `small ${kind === "ok" ? "ok" : kind === "err" ? "err" : "muted"}`;
}

function setWebhookStatus(text, kind = "muted") {
  const el = document.getElementById("webhookStatus");
  el.textContent = text;
  el.className = `small ${kind === "ok" ? "ok" : kind === "err" ? "err" : "muted"}`;
}

function setRosterStatus(text, kind = "muted") {
  const el = document.getElementById("rosterStatus");
  el.textContent = text;
  el.className = `small ${kind === "ok" ? "ok" : kind === "err" ? "err" : "muted"}`;
}

function setGeoStatus(text, kind = "muted") {
  const el = document.getElementById("geoStatus");
  el.textContent = text;
  el.className = `small ${kind === "ok" ? "ok" : kind === "err" ? "err" : "muted"}`;
}

function isSessionActive(session) {
  if (!session) return false;
  const start = new Date(session.createdAtIso).getTime();
  const durationMs = (Number(session.durationMin || 0) || 0) * 60_000;
  if (!durationMs) return true;
  return Date.now() <= start + durationMs;
}

function toCsv(header, rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const lines = [header.map(esc).join(",")];
  for (const r of rows) lines.push(r.map(esc).join(","));
  return lines.join("\n");
}

function parseCsv(text) {
  // Simple CSV parser (handles quoted fields).
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQ) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (ch !== "\r") cur += ch;
    }
  }
  row.push(cur);
  rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation is not supported in this browser."));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

async function sha256Hex(text) {
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const arr = Array.from(new Uint8Array(digest));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getSettings() {
  return loadJson(STORAGE_KEYS.settings, {
    pinHash: null,
    sheetsWebhookUrl: "",
    defaulterThreshold: DEFAULT_DEFAULTER_THRESHOLD,
  });
}

function setSettings(next) {
  saveJson(STORAGE_KEYS.settings, next);
}

function isTeacherUnlocked() {
  return sessionStorage.getItem(SESSION_UNLOCK_KEY) === "1";
}

function setTeacherUnlocked(v) {
  if (v) sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
  else sessionStorage.removeItem(SESSION_UNLOCK_KEY);
}

function ensureDefaults() {
  // migrate legacy data if present
  const legacyAttendance = loadJson(STORAGE_KEYS.legacyAttendance, null);
  const legacySession = loadJson(STORAGE_KEYS.legacyActiveSession, null);
  const hasV2 = localStorage.getItem(STORAGE_KEYS.attendance);

  if (!hasV2 && (legacyAttendance || legacySession)) {
    const courses = [
      { id: "general", name: "General", subject: "", createdAtIso: nowIso() },
    ];
    saveJson(STORAGE_KEYS.courses, courses);
    saveJson(STORAGE_KEYS.rosters, {});
    saveJson(STORAGE_KEYS.sessions, []);

    let activeSession = null;
    if (legacySession) {
      activeSession = {
        id: uid(),
        code: legacySession.code,
        courseId: "general",
        sessionName: legacySession.name || "",
        roomName: "",
        durationMin: legacySession.durationMin || 60,
        createdAtIso: legacySession.createdAtIso || nowIso(),
        geoLat: null,
        geoLng: null,
        geoRadiusM: DEFAULT_GEOFENCE_M,
      };
      saveJson(STORAGE_KEYS.activeSession, activeSession);
    }

    const sessions = loadJson(STORAGE_KEYS.sessions, []);
    if (activeSession) sessions.push({ ...activeSession, endedAtIso: null });
    saveJson(STORAGE_KEYS.sessions, sessions);

    const attendance = (legacyAttendance || []).map((r) => ({
      id: uid(),
      sessionId: activeSession?.id || "legacy",
      courseId: "general",
      sessionCode: r.sessionCode,
      sessionName: r.sessionName || "",
      roll: r.studentId || "",
      name: r.name || "",
      timestampIso: r.timestampIso || nowIso(),
      lat: null,
      lng: null,
      distanceM: null,
      sentToSheets: false,
    }));
    saveJson(STORAGE_KEYS.attendance, attendance);
    saveJson(STORAGE_KEYS.pendingPosts, []);
    // keep legacy keys (do not delete), but v2 takes priority now.
  }

  // ensure v2 keys exist
  const courses = loadJson(STORAGE_KEYS.courses, null);
  if (!courses) {
    saveJson(STORAGE_KEYS.courses, [{ id: "general", name: "General", subject: "", createdAtIso: nowIso() }]);
  }
  if (!localStorage.getItem(STORAGE_KEYS.rosters)) saveJson(STORAGE_KEYS.rosters, {});
  if (!localStorage.getItem(STORAGE_KEYS.sessions)) saveJson(STORAGE_KEYS.sessions, []);
  if (!localStorage.getItem(STORAGE_KEYS.attendance)) saveJson(STORAGE_KEYS.attendance, []);
  if (!localStorage.getItem(STORAGE_KEYS.pendingPosts)) saveJson(STORAGE_KEYS.pendingPosts, []);
  if (!localStorage.getItem(STORAGE_KEYS.settings)) saveJson(STORAGE_KEYS.settings, getSettings());
}

function getCourses() {
  return loadJson(STORAGE_KEYS.courses, []);
}

function setCourses(courses) {
  saveJson(STORAGE_KEYS.courses, courses);
}

function getRosters() {
  return loadJson(STORAGE_KEYS.rosters, {});
}

function setRosters(rosters) {
  saveJson(STORAGE_KEYS.rosters, rosters);
}

function getAttendance() {
  return loadJson(STORAGE_KEYS.attendance, []);
}

function setAttendance(att) {
  saveJson(STORAGE_KEYS.attendance, att);
}

function getActiveSession() {
  return loadJson(STORAGE_KEYS.activeSession, null);
}

function setActiveSession(s) {
  saveJson(STORAGE_KEYS.activeSession, s);
}

function getSessions() {
  return loadJson(STORAGE_KEYS.sessions, []);
}

function setSessions(sessions) {
  saveJson(STORAGE_KEYS.sessions, sessions);
}

function getPendingPosts() {
  return loadJson(STORAGE_KEYS.pendingPosts, []);
}

function setPendingPosts(list) {
  saveJson(STORAGE_KEYS.pendingPosts, list);
}

function courseById(courseId) {
  return getCourses().find((c) => c.id === courseId) || null;
}

function renderTeacherVisibility() {
  const unlocked = isTeacherUnlocked();
  document.querySelectorAll(".teacherOnly").forEach((el) => {
    if (unlocked) el.classList.add("unlocked");
    else el.classList.remove("unlocked");
  });
  document.getElementById("lockBtn").disabled = !unlocked;
}

function renderCourseSelect() {
  const select = document.getElementById("courseSelect");
  if (!select) return;
  const courses = getCourses();
  const prev = select.value || courses[0]?.id || "general";
  select.innerHTML = "";
  for (const c of courses) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.subject ? `${c.name} — ${c.subject}` : c.name;
    select.appendChild(opt);
  }
  select.value = courses.some((c) => c.id === prev) ? prev : courses[0]?.id;
  renderRosterStatus();
}

function renderRosterStatus() {
  const courseEl = document.getElementById("courseSelect");
  if (!courseEl) return;
  const courseId = courseEl.value;
  const rosters = getRosters();
  const roster = rosters[courseId];
  if (!roster) return setRosterStatus("No roster loaded for this course.", "muted");
  setRosterStatus(`Roster: ${roster.count} students • Imported ${formatLocal(roster.importedAtIso)}`, "ok");
}

function computeJoinLink(code) {
  // Use a URL so scanning opens the Student screen with the code prefilled.
  const url = new URL(window.location.href);
  url.searchParams.set("mode", "student");
  url.searchParams.set("join", code);
  return url.toString();
}

function drawQr(canvas, text) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!text) return;

  // For our small payload, version 4 is safe.
  try {
    const qr = qrcode(4, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const cell = Math.floor(canvas.width / count);
    const offset = Math.floor((canvas.width - cell * count) / 2);
    ctx.save();
    ctx.translate(offset, offset);
    qr.renderTo2dContext(ctx, cell);
    ctx.restore();
  } catch (e) {
    // fallback: show nothing
  }
}

function getUiMode() {
  try {
    const url = new URL(window.location.href);
    const m = (url.searchParams.get("mode") || "").toLowerCase();
    if (m === "student" || m === "faculty") return m;
  } catch {
    // ignore
  }
  const saved = (localStorage.getItem(STORAGE_KEYS.uiMode) || "").toLowerCase();
  return saved === "faculty" ? "faculty" : "student";
}

function setUiMode(mode) {
  const m = mode === "faculty" ? "faculty" : "student";
  localStorage.setItem(STORAGE_KEYS.uiMode, m);
  render();
}

function renderModeVisibility() {
  const mode = getUiMode();
  const facultySection = document.getElementById("facultySection");
  const studentSection = document.getElementById("studentSection");
  const modeStudentBtn = document.getElementById("modeStudentBtn");
  const modeFacultyBtn = document.getElementById("modeFacultyBtn");
  const modeHint = document.getElementById("modeHint");

  if (facultySection) facultySection.classList.toggle("hidden", mode !== "faculty");
  if (studentSection) studentSection.classList.toggle("hidden", mode !== "student");

  if (modeStudentBtn) modeStudentBtn.classList.toggle("primary", mode === "student");
  if (modeFacultyBtn) modeFacultyBtn.classList.toggle("primary", mode === "faculty");

  if (modeHint) {
    modeHint.textContent =
      mode === "student"
        ? "Student mode: only check-in is visible."
        : "Faculty mode: unlock with PIN to create sessions, manage courses, and export reports.";
  }
}

function render() {
  renderModeVisibility();
  renderTeacherVisibility();
  renderCourseSelect();

  const session = getActiveSession();
  const attendance = getAttendance();

  // Active session display
  const activeCode = document.getElementById("activeCode");
  const activeMeta = document.getElementById("activeMeta");
  const joinLinkEl = document.getElementById("joinLink");
  const qrCanvas = document.getElementById("qrCanvas");

  if (session && isSessionActive(session)) {
    activeCode.textContent = session.code;
    const c = courseById(session.courseId);
    activeMeta.textContent = `${c ? c.name : "Course"} • ${session.sessionName || "Untitled"} • Room ${
      session.roomName || "—"
    } • ${session.durationMin} min`;
    const link = computeJoinLink(session.code);
    joinLinkEl.innerHTML = `QR payload: <span class="muted">${escapeHtml(link)}</span>`;
    drawQr(qrCanvas, link);
    if (session.geoLat && session.geoLng) {
      setGeoStatus(`Classroom location set • Radius ${session.geoRadiusM}m`, "ok");
    } else {
      setGeoStatus("Location not set (geo-fence will be skipped).", "err");
    }
  } else if (session) {
    activeCode.textContent = "—";
    activeMeta.textContent = "Session expired. Create a new session.";
    joinLinkEl.textContent = "—";
    drawQr(qrCanvas, "");
  } else {
    activeCode.textContent = "—";
    activeMeta.textContent = "No active session";
    joinLinkEl.textContent = "—";
    drawQr(qrCanvas, "");
    setGeoStatus("Location not set", "muted");
  }

  // Dashboard stats
  const statSession = document.getElementById("statSession");
  const statTotal = document.getElementById("statTotal");
  const statUnique = document.getElementById("statUnique");
  const statLast = document.getElementById("statLast");

  statSession.textContent =
    session && isSessionActive(session)
      ? `${session.code} (${session.sessionName || "Untitled"})`
      : "—";
  statTotal.textContent = String(attendance.length);
  const unique = new Set(attendance.map((r) => (r.roll || r.name || "").trim().toLowerCase()));
  unique.delete("");
  statUnique.textContent = String(unique.size);
  statLast.textContent = attendance.length ? formatLocal(attendance[attendance.length - 1].timestampIso) : "—";

  // Table
  const tbody = document.querySelector("#attendanceTable tbody");
  tbody.innerHTML = "";
  attendance
    .slice()
    .reverse()
    .slice(0, 200)
    .forEach((r, i) => {
      const course = courseById(r.courseId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${attendance.length - i}</td>
        <td>${escapeHtml(r.name || "—")}</td>
        <td>${escapeHtml(r.roll || "—")}</td>
        <td>${escapeHtml(course ? (course.subject ? `${course.name} — ${course.subject}` : course.name) : "—")}</td>
        <td>${escapeHtml(r.sessionName || r.sessionCode || "—")}</td>
        <td>${escapeHtml(formatLocal(r.timestampIso))}</td>
      `;
      tbody.appendChild(tr);
    });

  // webhook UI
  const settings = getSettings();
  const webhookInput = document.getElementById("sheetsWebhook");
  if (webhookInput) {
    webhookInput.value = settings.sheetsWebhookUrl || "";
    setWebhookStatus(
      settings.sheetsWebhookUrl ? "Configured." : "Not configured.",
      settings.sheetsWebhookUrl ? "ok" : "muted",
    );
  }
}

async function unlockWithPin(pin) {
  const settings = getSettings();
  if (!pin || pin.length < 4) {
    setPinMsg("PIN must be at least 4 digits.", "err");
    return;
  }
  const pinHash = await sha256Hex(pin);
  if (!settings.pinHash) {
    settings.pinHash = pinHash;
    setSettings(settings);
    setTeacherUnlocked(true);
    setPinMsg("PIN set. Teacher mode unlocked.", "ok");
    render();
    return;
  }
  if (settings.pinHash !== pinHash) {
    setPinMsg("Wrong PIN.", "err");
    return;
  }
  setTeacherUnlocked(true);
  setPinMsg("Teacher mode unlocked.", "ok");
  render();
}

function lockTeacher() {
  setTeacherUnlocked(false);
  setPinMsg("Teacher mode locked.", "muted");
  render();
}

async function setClassroomLocationOnActiveSession() {
  const session = getActiveSession();
  if (!session || !isSessionActive(session)) {
    setGeoStatus("Create a session first, then set location.", "err");
    return;
  }
  try {
    setGeoStatus("Getting your location… allow permission.", "muted");
    const pos = await getCurrentPosition();
    session.geoLat = pos.coords.latitude;
    session.geoLng = pos.coords.longitude;
    session.geoRadiusM = Number(document.getElementById("geoRadius").value || DEFAULT_GEOFENCE_M);
    setActiveSession(session);
    setGeoStatus(`Location set • Radius ${session.geoRadiusM}m`, "ok");
    render();
  } catch (e) {
    setGeoStatus("Could not get location. Use HTTPS / allow permission.", "err");
  }
}

function createSession() {
  if (!isTeacherUnlocked()) {
    setMsg("Teacher mode is locked.", "err");
    return;
  }

  const courseId = document.getElementById("courseSelect").value;
  const sessionName = document.getElementById("sessionName").value.trim();
  const roomName = document.getElementById("roomName").value.trim();
  const durationMin = Number(document.getElementById("duration").value || 60);
  const geoRadiusM = Number(document.getElementById("geoRadius").value || DEFAULT_GEOFENCE_M);

  const code = randomCode6();
  const s = {
    id: uid(),
    code,
    courseId,
    sessionName,
    roomName,
    durationMin: Math.max(5, Math.min(480, durationMin || 60)),
    createdAtIso: nowIso(),
    geoLat: null,
    geoLng: null,
    geoRadiusM: Math.max(10, Math.min(1000, geoRadiusM || DEFAULT_GEOFENCE_M)),
  };
  setActiveSession(s);

  const sessions = getSessions();
  sessions.push({ ...s, endedAtIso: null });
  setSessions(sessions);

  document.getElementById("sessionCodeInput").value = code;
  setMsg("Session created. Students can check in now.", "ok");
  render();
}

function endActiveSession() {
  if (!isTeacherUnlocked()) return setMsg("Teacher mode is locked.", "err");
  const s = getActiveSession();
  if (!s) return;
  const sessions = getSessions().map((x) => (x.id === s.id ? { ...x, endedAtIso: nowIso() } : x));
  setSessions(sessions);
  setActiveSession(null);
  setMsg("Active session ended.", "ok");
  render();
}

function addCourse() {
  if (!isTeacherUnlocked()) return setMsg("Teacher mode is locked.", "err");
  const name = document.getElementById("newCourseName").value.trim();
  const subject = document.getElementById("newCourseSubject").value.trim();
  if (!name) return setMsg("Enter a course name.", "err");
  const courses = getCourses();
  const c = { id: uid(), name, subject, createdAtIso: nowIso() };
  courses.push(c);
  setCourses(courses);
  document.getElementById("newCourseName").value = "";
  document.getElementById("newCourseSubject").value = "";
  setMsg("Course added.", "ok");
  renderCourseSelect();
}

function deleteSelectedCourse() {
  if (!isTeacherUnlocked()) return setMsg("Teacher mode is locked.", "err");
  const select = document.getElementById("courseSelect");
  const courseId = select.value;
  if (courseId === "general") return setMsg("Cannot delete the default General course.", "err");
  if (!confirm("Delete this course and its roster? (Attendance records stay, but will show course as —)")) return;
  const courses = getCourses().filter((c) => c.id !== courseId);
  setCourses(courses);
  const rosters = getRosters();
  delete rosters[courseId];
  setRosters(rosters);
  setMsg("Course deleted.", "ok");
  render();
}

async function importRoster() {
  if (!isTeacherUnlocked()) return setMsg("Teacher mode is locked.", "err");
  const courseId = document.getElementById("courseSelect").value;
  const file = document.getElementById("rosterFile").files?.[0];
  if (!file) return setRosterStatus("Choose a CSV file first.", "err");
  const text = await file.text();
  const rows = parseCsv(text);
  if (!rows.length) return setRosterStatus("CSV seems empty.", "err");

  // Accept either with header or without
  let start = 0;
  const header = rows[0].map((s) => s.toLowerCase());
  const hasHeader = header.includes("roll") || header.includes("id") || header.includes("name");
  if (hasHeader) start = 1;

  const map = {};
  let count = 0;
  for (let i = start; i < rows.length; i++) {
    const [rollRaw, nameRaw] = rows[i];
    const roll = String(rollRaw || "").trim();
    const name = String(nameRaw || "").trim();
    if (!roll) continue;
    map[roll.toLowerCase()] = { roll, name };
    count++;
  }
  if (!count) return setRosterStatus("No valid rows found. Expected: roll,name", "err");

  const rosters = getRosters();
  rosters[courseId] = { importedAtIso: nowIso(), count, students: map };
  setRosters(rosters);
  setRosterStatus(`Imported ${count} students for this course.`, "ok");
  render();
}

function saveWebhook() {
  if (!isTeacherUnlocked()) return setMsg("Teacher mode is locked.", "err");
  const url = document.getElementById("sheetsWebhook").value.trim();
  const settings = getSettings();
  settings.sheetsWebhookUrl = url;
  setSettings(settings);
  setWebhookStatus(url ? "Saved." : "Cleared.", url ? "ok" : "muted");
}

async function postToWebhook(payload) {
  const settings = getSettings();
  if (!settings.sheetsWebhookUrl) return { ok: false, reason: "No webhook configured." };
  try {
    const res = await fetch(settings.sheetsWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "Network error" };
  }
}

async function trySendAttendanceToSheets(record) {
  const course = courseById(record.courseId);
  const payload = {
    source: "SmartAttendanceLite",
    roll: record.roll,
    name: record.name,
    courseName: course?.name || "",
    subject: course?.subject || "",
    sessionCode: record.sessionCode,
    sessionName: record.sessionName,
    timestampIso: record.timestampIso,
    lat: record.lat,
    lng: record.lng,
    distanceM: record.distanceM,
  };
  const res = await postToWebhook(payload);
  return res.ok;
}

async function sendPending() {
  if (!isTeacherUnlocked()) return setMsg("Teacher mode is locked.", "err");
  const pending = getPendingPosts();
  if (!pending.length) return setWebhookStatus("No pending records.", "ok");
  const att = getAttendance();
  let okCount = 0;
  let failCount = 0;
  const still = [];
  for (const id of pending) {
    const r = att.find((x) => x.id === id);
    if (!r) continue;
    const ok = await trySendAttendanceToSheets(r);
    if (ok) {
      okCount++;
      r.sentToSheets = true;
    } else {
      failCount++;
      still.push(id);
    }
  }
  setAttendance(att);
  setPendingPosts(still);
  setWebhookStatus(
    `Sent: ${okCount}. Pending: ${still.length}. ${failCount ? "Some failed (check URL/internet)." : ""}`,
    failCount ? "err" : "ok",
  );
  render();
}

async function checkIn() {
  const roll = document.getElementById("studentId").value.trim();
  let name = document.getElementById("studentName").value.trim();
  const code = document.getElementById("sessionCodeInput").value.trim();

  if (!roll) return setMsg("Please enter your roll number / ID.", "err");
  if (!/^\d{6}$/.test(code)) return setMsg("Please enter a valid 6-digit session code.", "err");

  const session = getActiveSession();
  if (!session || !isSessionActive(session) || session.code !== code) {
    return setMsg("Invalid/expired session code. Ask the teacher for the latest code.", "err");
  }

  const rosters = getRosters();
  const roster = rosters[session.courseId];
  const rollKey = roll.trim().toLowerCase();
  if (roster) {
    const student = roster.students[rollKey];
    if (!student) return setMsg("Roll number not found in class roster.", "err");
    if (!name) {
      name = student.name || "";
      document.getElementById("studentName").value = name;
    }
  }
  if (!name) return setMsg("Please enter your name.", "err");

  // geo-fence (optional but recommended)
  let lat = null, lng = null, distanceM = null;
  if (session.geoLat && session.geoLng) {
    try {
      setMsg("Checking location… allow permission.", "muted");
      const pos = await getCurrentPosition();
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      distanceM = Math.round(haversineMeters(session.geoLat, session.geoLng, lat, lng));
      if (distanceM > Number(session.geoRadiusM || DEFAULT_GEOFENCE_M)) {
        return setMsg(`You seem too far from the classroom (${distanceM}m).`, "err");
      }
    } catch (e) {
      return setMsg("Location permission required for this class.", "err");
    }
  }

  const attendance = getAttendance();
  const already = attendance.some((r) => r.sessionId === session.id && r.roll?.toLowerCase() === rollKey);
  if (already) return setMsg("Already checked in for this session.", "err");

  const record = {
    id: uid(),
    sessionId: session.id,
    courseId: session.courseId,
    sessionCode: session.code,
    sessionName: session.sessionName || "",
    roll,
    name,
    timestampIso: nowIso(),
    lat,
    lng,
    distanceM,
    sentToSheets: false,
  };
  attendance.push(record);
  setAttendance(attendance);
  setMsg("Check-in successful!", "ok");

  // Try sync (optional)
  const settings = getSettings();
  if (settings.sheetsWebhookUrl) {
    const ok = await trySendAttendanceToSheets(record);
    if (!ok) {
      const pending = getPendingPosts();
      pending.push(record.id);
      setPendingPosts(pending);
      setMsg("Checked in. (Saved offline; will sync later.)", "ok");
    } else {
      record.sentToSheets = true;
      setAttendance(attendance);
    }
  }
  render();
}

function exportSessionCsv() {
  if (!isTeacherUnlocked()) return setMsg("Teacher mode is locked.", "err");
  const s = getActiveSession();
  if (!s) return setMsg("No active session.", "err");
  const course = courseById(s.courseId);
  const rows = getAttendance().filter((r) => r.sessionId === s.id);
  const header = ["roll", "name", "course", "subject", "sessionCode", "sessionName", "timestampIso", "distanceM"];
  const csv = toCsv(
    header,
    rows.map((r) => [
      r.roll,
      r.name,
      course?.name || "",
      course?.subject || "",
      r.sessionCode,
      r.sessionName,
      r.timestampIso,
      r.distanceM ?? "",
    ]),
  );
  const date = new Date().toISOString().slice(0, 10);
  download(`attendance_session_${date}.csv`, csv);
}

function exportCourseReport() {
  if (!isTeacherUnlocked()) return setMsg("Teacher mode is locked.", "err");
  const courseId = document.getElementById("courseSelect").value;
  const course = courseById(courseId);
  const rosters = getRosters();
  const roster = rosters[courseId];
  const sessions = getSessions().filter((s) => s.courseId === courseId);
  const totalSessions = sessions.length || 0;
  const att = getAttendance().filter((r) => r.courseId === courseId);

  const byRoll = new Map();
  for (const r of att) {
    const key = (r.roll || "").toLowerCase();
    if (!key) continue;
    if (!byRoll.has(key)) byRoll.set(key, { roll: r.roll, name: r.name, present: new Set() });
    byRoll.get(key).present.add(r.sessionId);
  }

  const settings = getSettings();
  const threshold = Number(settings.defaulterThreshold || DEFAULT_DEFAULTER_THRESHOLD);

  const students = [];
  if (roster) {
    for (const k of Object.keys(roster.students)) {
      const st = roster.students[k];
      const present = byRoll.get(k)?.present?.size || 0;
      const percent = totalSessions ? Math.round((present / totalSessions) * 100) : 0;
      students.push({
        roll: st.roll,
        name: st.name,
        present,
        percent,
        status: percent >= threshold ? "OK" : "DEFAULTER",
      });
    }
  } else {
    for (const [k, v] of byRoll.entries()) {
      const present = v.present.size;
      const percent = totalSessions ? Math.round((present / totalSessions) * 100) : 0;
      students.push({
        roll: v.roll,
        name: v.name,
        present,
        percent,
        status: percent >= threshold ? "OK" : "DEFAULTER",
      });
    }
  }

  students.sort((a, b) => a.roll.localeCompare(b.roll));
  const header = ["roll", "name", "course", "subject", "presentSessions", "totalSessions", "percent", "status"];
  const csv = toCsv(
    header,
    students.map((s) => [
      s.roll,
      s.name,
      course?.name || "",
      course?.subject || "",
      s.present,
      totalSessions,
      s.percent,
      s.status,
    ]),
  );
  const date = new Date().toISOString().slice(0, 10);
  download(`attendance_course_report_${date}.csv`, csv);
}

function applyJoinFromUrl() {
  try {
    const url = new URL(window.location.href);
    const join = url.searchParams.get("join");
    if (join && /^\d{6}$/.test(join)) {
      setUiMode("student");
      document.getElementById("sessionCodeInput").value = join;
      setMsg("Session code filled from QR/link.", "ok");
    }
  } catch {
    // ignore
  }
}

function attach() {
  // Storage availability
  const storageStatus = document.getElementById("storageStatus");
  try {
    localStorage.setItem("__sal_test", "1");
    localStorage.removeItem("__sal_test");
    storageStatus.textContent = "Storage: ready";
  } catch {
    storageStatus.textContent = "Storage: blocked (use another browser)";
  }

  // Mode switch
  document.getElementById("modeStudentBtn").addEventListener("click", () => setUiMode("student"));
  document.getElementById("modeFacultyBtn").addEventListener("click", () => setUiMode("faculty"));

  // Teacher unlock
  document.getElementById("unlockBtn").addEventListener("click", async () => {
    const pin = document.getElementById("pinInput").value.trim();
    await unlockWithPin(pin);
  });
  document.getElementById("lockBtn").addEventListener("click", () => lockTeacher());

  // Session + geo
  document.getElementById("createSessionBtn").addEventListener("click", () => createSession());
  document.getElementById("endSessionBtn").addEventListener("click", () => endActiveSession());
  document.getElementById("setGeoBtn").addEventListener("click", () => setClassroomLocationOnActiveSession());

  // Student check-in
  document.getElementById("checkInBtn").addEventListener("click", () => checkIn());
  document.getElementById("sessionCodeInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("checkInBtn").click();
  });
  document.getElementById("studentId").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("checkInBtn").click();
  });

  // Courses + roster
  document.getElementById("addCourseBtn").addEventListener("click", () => addCourse());
  document.getElementById("deleteCourseBtn").addEventListener("click", () => deleteSelectedCourse());
  document.getElementById("courseSelect").addEventListener("change", () => renderRosterStatus());
  document.getElementById("importRosterBtn").addEventListener("click", () => importRoster());

  // Sheets
  document.getElementById("saveWebhookBtn").addEventListener("click", () => saveWebhook());
  document.getElementById("sendPendingBtn").addEventListener("click", () => sendPending());

  // Exports
  document.getElementById("exportSessionCsvBtn").addEventListener("click", () => exportSessionCsv());
  document.getElementById("exportCourseReportBtn").addEventListener("click", () => exportCourseReport());

  // Reset
  document.getElementById("clearAllBtn").addEventListener("click", () => {
    if (!confirm("This will delete ALL local data in this browser. Continue?")) return;
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    setMsg("All data reset.", "ok");
    location.reload();
  });

  // Extra style hooks for messages
  const style = document.createElement("style");
  style.textContent = `
    .ok{color:#7CFFB2}
    .err{color:#FF8FA3}
  `;
  document.head.appendChild(style);

  applyJoinFromUrl();
  render();
}

ensureDefaults();
attach();
