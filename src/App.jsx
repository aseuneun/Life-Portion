import { useState, useEffect, useRef } from "react"
import { supabase } from "./supabaseClient"
import "./App.css"

function formatDate(date) {
  return date.toISOString().split("T")[0]
}

function getDateLabel(date) {
  const today = new Date()
  const diff = Math.round((date - new Date(today.toDateString())) / 86400000)
  const days = ["일", "월", "화", "수", "목", "금", "토"]
  const dayStr = days[date.getDay()]
  const label = `${date.getMonth() + 1}/${date.getDate()} (${dayStr})`
  if (diff === 0) return `오늘 · ${label}`
  if (diff === 1) return `내일 · ${label}`
  if (diff === -1) return `어제 · ${label}`
  return label
}

function PieChart({ areas, timeblocks, tasks, showCompleted }) {
  const vw = Math.min(window.innerWidth, 600)
  const size = vw * 0.92
  const cx = size / 2
  const cy = size / 2
  const outerR = size * 0.44
  const innerR = size * 0.12
  const n = areas.length
  if (n === 0) return null

  const totalMinutes = timeblocks.reduce((sum, tb) => {
    if (!tb.actual_start || !tb.actual_end) return sum
    const [sh, sm] = tb.actual_start.split(":").map(Number)
    const [eh, em] = tb.actual_end.split(":").map(Number)
    return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
  }, 0)

  const sliceAngle = (2 * Math.PI) / n
  const gap = 0.05

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <filter id="round">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="round" />
          <feComposite in="SourceGraphic" in2="round" operator="atop" />
        </filter>
      </defs>
      <g filter="url(#round)">
        {areas.map((area, i) => {
          const startAngle = i * sliceAngle - Math.PI / 2
          const endAngle = startAngle + sliceAngle
          const sa = startAngle + gap
          const ea = endAngle - gap
          const bx1 = cx + outerR * Math.cos(sa)
          const by1 = cy + outerR * Math.sin(sa)
          const bx2 = cx + outerR * Math.cos(ea)
          const by2 = cy + outerR * Math.sin(ea)
          const bx3 = cx + innerR * Math.cos(ea)
          const by3 = cy + innerR * Math.sin(ea)
          const bx4 = cx + innerR * Math.cos(sa)
          const by4 = cy + innerR * Math.sin(sa)
          const areaMinutes = timeblocks
            .filter(tb => tb.area_id === area.id && tb.actual_start && tb.actual_end)
            .reduce((sum, tb) => {
              const [sh, sm] = tb.actual_start.split(":").map(Number)
              const [eh, em] = tb.actual_end.split(":").map(Number)
              return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
            }, 0)
          const ratio = totalMinutes > 0 ? areaMinutes / totalMinutes : 0
          const minR = innerR + 8
          const maxR = outerR - 8
          const innerSliceR = minR + (maxR - minR) * Math.min(ratio * n, 1)
          const ix1 = cx + innerSliceR * Math.cos(sa)
          const iy1 = cy + innerSliceR * Math.sin(sa)
          const ix2 = cx + innerSliceR * Math.cos(ea)
          const iy2 = cy + innerSliceR * Math.sin(ea)
          const ix3 = cx + innerR * Math.cos(ea)
          const iy3 = cy + innerR * Math.sin(ea)
          const ix4 = cx + innerR * Math.cos(sa)
          const iy4 = cy + innerR * Math.sin(sa)
          return (
            <g key={area.id}>
              <path
                d={`M ${bx1} ${by1} A ${outerR} ${outerR} 0 0 1 ${bx2} ${by2} L ${bx3} ${by3} A ${innerR} ${innerR} 0 0 0 ${bx4} ${by4} Z`}
                fill="#c8bfb0"
              />
              <path
                d={`M ${ix1} ${iy1} A ${innerSliceR} ${innerSliceR} 0 0 1 ${ix2} ${iy2} L ${ix3} ${iy3} A ${innerR} ${innerR} 0 0 0 ${ix4} ${iy4} Z`}
                fill="#f0ece4"
              />
            </g>
          )
        })}
        <circle cx={cx} cy={cy} r={innerR - 1} fill="#f5f0e8" />
      </g>
      {areas.map((area, i) => {
        const startAngle = i * sliceAngle - Math.PI / 2
        const endAngle = startAngle + sliceAngle
        const sa = startAngle + gap
        const ea = endAngle - gap
        const midAngle = (sa + ea) / 2
        const labelR = outerR * 0.75
        const lx = cx + labelR * Math.cos(midAngle)
        const ly = cy + labelR * Math.sin(midAngle)
        const areaTasks = tasks.filter(t => t.area_id === area.id)
        const count = showCompleted
          ? areaTasks.filter(t => t.status === "done").length
          : areaTasks.filter(t => t.status !== "done").length
        return (
          <g key={`label-${area.id}`}>
            <text x={lx} y={ly - 7} textAnchor="middle" fontSize="13" fill="#2a1f1a" fontWeight="700" fontFamily="'Noto Sans KR', sans-serif">
              {count}
            </text>
            <text x={lx} y={ly + 8} textAnchor="middle" fontSize="8" fill="#9a8880" fontWeight="400" fontFamily="'Noto Sans KR', sans-serif">
              {area.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function App() {
  const [tab, setTab] = useState("diagram")
  const [areas, setAreas] = useState([])
  const [tasks, setTasks] = useState([])
  const [timeblocks, setTimeblocks] = useState([])
  const [notes, setNotes] = useState([])
  const [newTitle, setNewTitle] = useState("")
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverArea, setDragOverArea] = useState(null)
  const [movePopup, setMovePopup] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [blockTab, setBlockTab] = useState("plan")
  const [editingBlock, setEditingBlock] = useState(null)
  const [blockForm, setBlockForm] = useState({ area_id: "", task_id: "", plan_start: "", plan_end: "", actual_start: "", actual_end: "" })
  const [newNote, setNewNote] = useState("")
  const [showCompleted, setShowCompleted] = useState(false)
  const [addPopup, setAddPopup] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingArea, setEditingArea] = useState(null)
  const [newAreaName, setNewAreaName] = useState("")
  const [newAreaColor, setNewAreaColor] = useState("#542916")
  const inputRef = useRef(null)
  const longPressTimer = useRef(null)
  const touchMoved = useRef(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [a, t, tb, n] = await Promise.all([
      supabase.from("areas").select("*").order("sort_order"),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("timeblocks").select("*").order("plan_start"),
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
    ])
    if (a.data) setAreas(a.data)
    if (t.data) setTasks(t.data)
    if (tb.data) setTimeblocks(tb.data)
    if (n.data) setNotes(n.data)
  }

  async function addTask() {
    const t = newTitle.trim()
    if (!t) return
    setNewTitle("")
    await supabase.from("tasks").insert({ title: t, status: "dump", area_id: null })
    await fetchAll()
  }

  async function assignArea(taskId, areaId) {
    await supabase.from("tasks").update({ area_id: areaId, status: "todo" }).eq("id", taskId)
    await fetchAll()
    setMovePopup(null)
  }

  async function completeTask(taskId) {
    await supabase.from("tasks").update({ status: "done" }).eq("id", taskId)
    await fetchAll()
  }

  async function deleteTask(taskId) {
    await supabase.from("tasks").delete().eq("id", taskId)
    await fetchAll()
  }

  async function addNote() {
    const n = newNote.trim()
    if (!n) return
    setNewNote("")
    await supabase.from("notes").insert({ content: n })
    await fetchAll()
  }

  async function deleteNote(id) {
    await supabase.from("notes").delete().eq("id", id)
    await fetchAll()
  }

  async function saveBlock() {
    if (!blockForm.area_id) return
    if (editingBlock) {
      await supabase.from("timeblocks").update(blockForm).eq("id", editingBlock)
    } else {
      await supabase.from("timeblocks").insert({ ...blockForm, date: formatDate(selectedDate) })
    }
    setEditingBlock(null)
    setBlockForm({ area_id: "", task_id: "", plan_start: "", plan_end: "", actual_start: "", actual_end: "" })
    await fetchAll()
  }

  async function deleteBlock(id) {
    await supabase.from("timeblocks").delete().eq("id", id)
    await fetchAll()
  }

  async function addArea() {
    if (!newAreaName.trim()) return
    const maxOrder = areas.reduce((max, a) => Math.max(max, a.sort_order || 0), 0)
    await supabase.from("areas").insert({ name: newAreaName.trim(), color: newAreaColor, sort_order: maxOrder + 1 })
    setNewAreaName("")
    setNewAreaColor("#542916")
    await fetchAll()
  }

  async function updateArea(id, updates) {
    await supabase.from("areas").update(updates).eq("id", id)
    setEditingArea(null)
    await fetchAll()
  }

  async function deleteArea(id) {
    await supabase.from("areas").delete().eq("id", id)
    await fetchAll()
  }

  function onDragStart(e, task) {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "move"
  }

  function onDragOver(e, areaId) {
    e.preventDefault()
    setDragOverArea(areaId)
  }

  function onDrop(e, areaId) {
    e.preventDefault()
    if (draggedTask) assignArea(draggedTask.id, areaId)
    setDraggedTask(null)
    setDragOverArea(null)
  }

  function onDragEnd() {
    setDraggedTask(null)
    setDragOverArea(null)
  }

  function onTouchStart(e, task) {
    touchMoved.current = false
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) setMovePopup({ task })
    }, 500)
  }

  function onTouchMove() {
    touchMoved.current = true
    clearTimeout(longPressTimer.current)
  }

  function onTouchEnd() {
    clearTimeout(longPressTimer.current)
  }

  const inboxTasks = tasks.filter(t => t.status === "dump")
  const dateStr = formatDate(selectedDate)
  const dayBlocks = timeblocks.filter(tb => tb.date === dateStr)

  return (
    <div className="app">

      {addPopup && (
        <div className="popup-overlay" onClick={() => setAddPopup(false)}>
          <div className="popup" onClick={e => e.stopPropagation()}>
            <p className="popup-title">무엇을 추가할까요?</p>
            <ul className="popup-list">
              <li>
                <button className="popup-item" onClick={() => { setAddPopup(false); setTab("dump"); setTimeout(() => inputRef.current?.focus(), 100) }}>
                  📥 인박스 태스크 추가
                </button>
              </li>
              <li>
                <button className="popup-item" onClick={() => { setAddPopup(false); setTab("block"); setEditingBlock(null); setBlockForm({ area_id: "", task_id: "", plan_start: "", plan_end: "", actual_start: "", actual_end: "" }) }}>
                  🕐 타임블록 추가
                </button>
              </li>
            </ul>
            <button className="popup-cancel" onClick={() => setAddPopup(false)}>취소</button>
          </div>
        </div>
      )}

      {movePopup && (
        <div className="popup-overlay" onClick={() => setMovePopup(null)}>
          <div className="popup" onClick={e => e.stopPropagation()}>
            <p className="popup-title">어느 영역으로 이동할까요?</p>
            <p className="popup-task-name">"{movePopup.task.title}"</p>
            <ul className="popup-list">
              {areas.map(area => (
                <li key={area.id}>
                  <button className="popup-item" onClick={() => assignArea(movePopup.task.id, area.id)}>
                    <span className="popup-area-dot" style={{ background: area.color }} />
                    {area.name}
                  </button>
                </li>
              ))}
            </ul>
            <button className="popup-cancel" onClick={() => setMovePopup(null)}>취소</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span>영역 설정</span>
              <button className="modal-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="area-add-row">
                <input type="color" value={newAreaColor} onChange={e => setNewAreaColor(e.target.value)} className="color-picker" />
                <input className="cat-input" placeholder="새 영역 이름" value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addArea()} />
                <button className="cat-add-btn" onClick={addArea}>추가</button>
              </div>
              <ul className="cat-list">
                {areas.map(area => (
                  <li key={area.id} className="cat-item">
                    {editingArea === area.id ? (
                      <div className="area-edit-row">
                        <input type="color" defaultValue={area.color} onChange={e => setNewAreaColor(e.target.value)} className="color-picker" />
                        <input className="cat-input" defaultValue={area.name} onChange={e => setNewAreaName(e.target.value)} />
                        <button className="cat-add-btn" onClick={() => updateArea(area.id, { name: newAreaName || area.name, color: newAreaColor || area.color })}>저장</button>
                      </div>
                    ) : (
                      <>
                        <div className="area-item-left">
                          <span className="area-dot" style={{ background: area.color }} />
                          <span>{area.name}</span>
                        </div>
                        <div className="area-item-actions">
                          <button className="cat-del" onClick={() => { setEditingArea(area.id); setNewAreaName(area.name); setNewAreaColor(area.color) }}>✎</button>
                          <button className="cat-del" onClick={() => deleteArea(area.id)}>✕</button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="page">

        {tab === "diagram" && (
          <div className="tab-content diagram-tab">
            <div className="diagram-header">
              <span className="app-title">Life.</span>
              <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙</button>
            </div>
            <div className="diagram-wrap">
              <PieChart areas={areas} timeblocks={timeblocks} tasks={tasks} showCompleted={showCompleted} />
            </div>
            <div className="toggle-row">
              <button className={`toggle-btn ${!showCompleted ? "active" : ""}`} onClick={() => setShowCompleted(false)}>미완료</button>
              <button className={`toggle-btn ${showCompleted ? "active" : ""}`} onClick={() => setShowCompleted(true)}>완료</button>
            </div>
          </div>
        )}

        {tab === "dump" && (
          <div className="tab-content">
            <div className="dump-header">
              <span className="section-heading">DUMP</span>
            </div>
            <div className="area-grid">
              {areas.map(area => {
                const areaTasks = tasks.filter(t => t.area_id === area.id && t.status !== "done")
                const doneTasks = tasks.filter(t => t.area_id === area.id && t.status === "done")
                const totalTasks = tasks.filter(t => t.area_id === area.id)
                const isDragOver = dragOverArea === area.id
                return (
                  <div key={area.id}
                    className={`area-folder ${isDragOver ? "folder-drag-over" : ""}`}
                    onDragOver={e => onDragOver(e, area.id)}
                    onDrop={e => onDrop(e, area.id)}
                  >
                    <div className="folder-top">
                      <span className="folder-icon">📁</span>
                      <button className="folder-more-btn">···</button>
                    </div>
                    <div className="folder-body">
                      <div className="folder-name">
                        <span className="folder-dot" style={{ background: area.color }} />
                        {area.name}
                      </div>
                      <div className="folder-progress">
                        🌟 {doneTasks.length}/{totalTasks.length} completed
                      </div>
                      {areaTasks.length > 0 && (
                        <div className="folder-tasks">
                          {areaTasks.slice(0, 2).map(task => (
                            <div key={task.id} className="folder-task-item" onClick={() => completeTask(task.id)}>
                              <span className="folder-task-title">{task.title}</span>
                            </div>
                          ))}
                          {areaTasks.length > 2 && <span className="folder-more">+{areaTasks.length - 2}개 더</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="inbox-section">
              <div className="inbox-header-row">
                <span className="inbox-label">INBOX</span>
                <span className="inbox-count">{inboxTasks.length}</span>
              </div>
              <div className="inbox-input-row">
                <input ref={inputRef} className="task-input" placeholder="생각나는 거 다 던져넣기..."
                  value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addTask() } }} />
              </div>
              {inboxTasks.length > 0 && <p className="drag-hint">폴더로 드래그하거나 길게 눌러서 영역 배치</p>}
              <ul className="task-list">
                {inboxTasks.map(task => (
                  <li key={task.id} className="task-item draggable" draggable
                    onDragStart={e => onDragStart(e, task)} onDragEnd={onDragEnd}
                    onTouchStart={e => onTouchStart(e, task)} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                    <span className="drag-handle">⠿</span>
                    <span className="task-title">{task.title}</span>
                    <button className="del-btn" onClick={() => deleteTask(task.id)}>✕</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === "block" && (
          <div className="tab-content">
            <div className="date-nav">
              <button className="date-arrow" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d) }}>‹</button>
              <span className="date-label">{getDateLabel(selectedDate)}</span>
              <button className="date-arrow" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d) }}>›</button>
            </div>
            <div className="block-tabs">
              <button className={`block-tab ${blockTab === "plan" ? "active" : ""}`} onClick={() => setBlockTab("plan")}>계획</button>
              <button className={`block-tab ${blockTab === "actual" ? "active" : ""}`} onClick={() => setBlockTab("actual")}>실제</button>
            </div>
            <div className="block-form">
              <select className="block-select" value={blockForm.area_id} onChange={e => setBlockForm(p => ({ ...p, area_id: e.target.value }))}>
                <option value="">영역 선택</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className="block-select" value={blockForm.task_id} onChange={e => setBlockForm(p => ({ ...p, task_id: e.target.value }))}>
                <option value="">태스크 선택 (선택사항)</option>
                {tasks.filter(t => t.status !== "done").map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              {blockTab === "plan" ? (
                <div className="time-row">
                  <input type="time" className="time-input" value={blockForm.plan_start} onChange={e => setBlockForm(p => ({ ...p, plan_start: e.target.value }))} />
                  <span className="time-sep">→</span>
                  <input type="time" className="time-input" value={blockForm.plan_end} onChange={e => setBlockForm(p => ({ ...p, plan_end: e.target.value }))} />
                </div>
              ) : (
                <div className="time-row">
                  <input type="time" className="time-input" value={blockForm.actual_start} onChange={e => setBlockForm(p => ({ ...p, actual_start: e.target.value }))} />
                  <span className="time-sep">→</span>
                  <input type="time" className="time-input" value={blockForm.actual_end} onChange={e => setBlockForm(p => ({ ...p, actual_end: e.target.value }))} />
                </div>
              )}
              <button className="block-save-btn" onClick={saveBlock}>{editingBlock ? "수정 완료" : "블록 추가"}</button>
              {editingBlock && <button className="block-cancel-btn" onClick={() => { setEditingBlock(null); setBlockForm({ area_id: "", task_id: "", plan_start: "", plan_end: "", actual_start: "", actual_end: "" }) }}>취소</button>}
            </div>
            <div className="block-list">
              {dayBlocks
                .filter(tb => blockTab === "plan" ? tb.plan_start : tb.actual_start)
                .sort((a, b) => (blockTab === "plan" ? a.plan_start : a.actual_start)?.localeCompare(blockTab === "plan" ? b.plan_start : b.actual_start))
                .map(tb => {
                  const area = areas.find(a => a.id === tb.area_id)
                  const task = tasks.find(t => t.id === tb.task_id)
                  const start = blockTab === "plan" ? tb.plan_start : tb.actual_start
                  const end = blockTab === "plan" ? tb.plan_end : tb.actual_end
                  let duration = ""
                  if (start && end) {
                    const [sh, sm] = start.split(":").map(Number)
                    const [eh, em] = end.split(":").map(Number)
                    const mins = (eh * 60 + em) - (sh * 60 + sm)
                    if (mins > 0) duration = mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`
                  }
                  return (
                    <div key={tb.id} className="block-item">
                      <div className="block-item-color" style={{ background: area?.color || "#ccc" }} />
                      <div className="block-item-body">
                        <div className="block-item-top">
                          <span className="block-item-area">{area?.name}</span>
                          {duration && <span className="block-item-duration">{duration}</span>}
                        </div>
                        <div className="block-item-time">{start} → {end}</div>
                        {task && <div className="block-item-task">{task.title}</div>}
                      </div>
                      <div className="block-item-actions">
                        <button className="del-btn" onClick={() => { setEditingBlock(tb.id); setBlockForm({ area_id: tb.area_id || "", task_id: tb.task_id || "", plan_start: tb.plan_start || "", plan_end: tb.plan_end || "", actual_start: tb.actual_start || "", actual_end: tb.actual_end || "" }) }}>✎</button>
                        <button className="del-btn" onClick={() => deleteBlock(tb.id)}>✕</button>
                      </div>
                    </div>
                  )
                })}
              {dayBlocks.filter(tb => blockTab === "plan" ? tb.plan_start : tb.actual_start).length === 0 && (
                <p className="empty-msg" style={{ padding: "24px 20px" }}>아직 블록이 없어요</p>
              )}
            </div>
          </div>
        )}

        {tab === "note" && (
          <div className="tab-content">
            <div className="dump-header">
              <span className="section-heading">노트</span>
            </div>
            <div className="notes-input-area">
              <input className="task-input" placeholder="조각 하나 던져넣기..."
                value={newNote} onChange={e => setNewNote(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addNote() } }} />
            </div>
            <ul className="notes-list">
              {notes.map(note => (
                <li key={note.id} className="note-item">
                  <span className="note-content">{note.content}</span>
                  <button className="del-btn" onClick={() => deleteNote(note.id)}>✕</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <nav className="bottom-nav">
        <button className={`nav-btn ${tab === "diagram" ? "active" : ""}`} onClick={() => setTab("diagram")}>
          <span className="nav-icon">◉</span>
          <span className="nav-label">라이프</span>
        </button>
        <button className={`nav-btn ${tab === "dump" ? "active" : ""}`} onClick={() => setTab("dump")}>
          <span className="nav-icon">📥</span>
          <span className="nav-label">덤프</span>
        </button>
        <button className="nav-add-btn" onClick={() => setAddPopup(true)}>
          <span>＋</span>
        </button>
        <button className={`nav-btn ${tab === "block" ? "active" : ""}`} onClick={() => setTab("block")}>
          <span className="nav-icon">🕐</span>
          <span className="nav-label">블록</span>
        </button>
        <button className={`nav-btn ${tab === "note" ? "active" : ""}`} onClick={() => setTab("note")}>
          <span className="nav-icon">✏️</span>
          <span className="nav-label">노트</span>
        </button>
      </nav>
    </div>
  )
}
