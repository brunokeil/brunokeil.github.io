import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Plus, Trash2, Settings, BarChart2, Info, RefreshCw, Cpu, List, CheckCircle, ChevronDown } from 'lucide-react';
import './App.css';

// --- Tick-by-Tick Simulation Logic ---

function simulateFIFO(tasks) {
  let sortedTasks = JSON.parse(JSON.stringify(tasks)).sort((a, b) => a.arrivalTime - b.arrivalTime);
  let history = [];
  
  let t = 0;
  let completed = [];
  let queue = [];
  let currentTask = null;
  
  while(completed.length < tasks.length) {
    let newlyArrived = sortedTasks.filter(task => task.arrivalTime === t).map(task => ({...task, remainingTime: task.burstTime}));
    queue.push(...newlyArrived);
    
    if (currentTask && currentTask.remainingTime === 0) {
      completed.push({
        ...currentTask, 
        completionTime: t, 
        turnaroundTime: t - currentTask.arrivalTime, 
        waitingTime: t - currentTask.arrivalTime - currentTask.burstTime
      });
      currentTask = null;
    }
    
    if (!currentTask && queue.length > 0) {
      currentTask = queue.shift();
    }
    
    history.push({
      time: t,
      running: currentTask ? currentTask.id : null,
      queue: queue.map(q => q.id),
      completed: completed.map(c => c.id)
    });
    
    if (currentTask) {
      currentTask.remainingTime--;
    }
    t++;
  }
  
  history.push({
    time: t,
    running: null,
    queue: [],
    completed: completed.map(c => c.id)
  });
  
  let executionLog = generateExecutionLog(history);
  return { history, executionLog, results: completed, totalTime: t };
}

function simulateRR(tasks, quantum) {
  let sortedTasks = JSON.parse(JSON.stringify(tasks)).sort((a, b) => a.arrivalTime - b.arrivalTime);
  let history = [];
  let t = 0;
  let completed = [];
  let queue = [];
  let currentTask = null;
  let quantumCounter = 0;
  
  while(completed.length < tasks.length) {
    let newlyArrived = sortedTasks.filter(task => task.arrivalTime === t).map(task => ({...task, remainingTime: task.burstTime}));
    
    if (currentTask && currentTask.remainingTime === 0) {
      completed.push({
        ...currentTask, 
        completionTime: t, 
        turnaroundTime: t - currentTask.arrivalTime, 
        waitingTime: t - currentTask.arrivalTime - currentTask.burstTime
      });
      currentTask = null;
      quantumCounter = 0;
    }
    
    if (currentTask && quantumCounter === parseInt(quantum)) {
      queue.push(currentTask);
      currentTask = null;
      quantumCounter = 0;
    }
    
    queue.push(...newlyArrived);
    
    if (!currentTask && queue.length > 0) {
      currentTask = queue.shift();
      quantumCounter = 0;
    }
    
    history.push({
      time: t,
      running: currentTask ? currentTask.id : null,
      queue: queue.map(q => q.id),
      completed: completed.map(c => c.id)
    });
    
    if (currentTask) {
      currentTask.remainingTime--;
      quantumCounter++;
    }
    t++;
  }
  
  history.push({
    time: t,
    running: null,
    queue: [],
    completed: completed.map(c => c.id)
  });
  
  let executionLog = generateExecutionLog(history);
  return { history, executionLog, results: completed, totalTime: t };
}

function generateExecutionLog(history) {
  if (history.length === 0) return [];
  let mergedLog = [];
  let currentBlock = { type: history[0].running, start: 0 };
  
  for (let i = 1; i < history.length; i++) {
    if (history[i].running !== currentBlock.type) {
      mergedLog.push({ taskId: currentBlock.type, startTime: currentBlock.start, endTime: i, isIdle: currentBlock.type === null });
      currentBlock = { type: history[i].running, start: i };
    }
  }
  return mergedLog;
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', 
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', 
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

// --- Custom Select Component ---
function CustomSelect({ options, value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`custom-select-container ${disabled ? 'disabled' : ''}`} ref={selectRef}>
      <div 
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span>{selectedOption ? selectedOption.label : 'Selecione'}</span>
        <ChevronDown size={18} className={`chevron ${isOpen ? 'rotate' : ''}`} />
      </div>
      {isOpen && !disabled && (
        <div className="custom-select-menu slide-down-fast">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function App() {
  const [tasks, setTasks] = useState([
    { id: 1, arrivalTime: 0, burstTime: 5 },
    { id: 2, arrivalTime: 1, burstTime: 3 },
    { id: 3, arrivalTime: 2, burstTime: 8 },
    { id: 4, arrivalTime: 3, burstTime: 6 }
  ]);
  const [algorithm, setAlgorithm] = useState('FIFO');
  const [quantum, setQuantum] = useState(2);
  const [playbackSpeed, setPlaybackSpeed] = useState(500); 
  
  const [simulationData, setSimulationData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const timerRef = useRef(null);
  
  const addTask = () => {
    const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    setTasks([...tasks, { id: newId, arrivalTime: 0, burstTime: 1 }]);
  };
  
  const updateTask = (id, field, value) => {
    setTasks(tasks.map(t => {
      if (t.id === id) {
        const minVal = field === 'burstTime' ? 1 : 0;
        return { ...t, [field]: Math.max(minVal, parseInt(value) || minVal) };
      }
      return t;
    }));
  };
  
  const removeTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };
  
  const prepareSimulation = () => {
    if (tasks.length === 0) return;
    
    let result;
    if (algorithm === 'FIFO') {
      result = simulateFIFO(tasks);
    } else {
      result = simulateRR(tasks, quantum);
    }
    setSimulationData(result);
    setCurrentTime(0);
    setIsPlaying(false);
  };
  
  const togglePlay = () => {
    if (!simulationData) prepareSimulation();
    if (currentTime >= (simulationData?.totalTime || 0) && isPlaying === false) {
      setCurrentTime(0); 
    }
    setIsPlaying(!isPlaying);
  };

  const stopSimulation = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };
  
  useEffect(() => {
    if (simulationData && !isPlaying) {
      prepareSimulation();
    }
  }, [tasks, algorithm, quantum]);
  
  useEffect(() => {
    if (isPlaying && simulationData && currentTime < simulationData.totalTime) {
      timerRef.current = setTimeout(() => {
        setCurrentTime(prev => prev + 1);
      }, playbackSpeed);
    } else if (currentTime >= (simulationData?.totalTime || 0)) {
      setIsPlaying(false);
    }
    
    return () => clearTimeout(timerRef.current);
  }, [isPlaying, currentTime, simulationData, playbackSpeed]);

  const getTaskColor = (id) => {
    return COLORS[(id - 1) % COLORS.length];
  };

  const currentState = simulationData?.history[currentTime] || { running: null, queue: [], completed: [] };
  const totalTime = simulationData?.totalTime || 0;

  const algOptions = [
    { value: 'FIFO', label: 'First-In, First-Out (FIFO)' },
    { value: 'RR', label: 'Round Robin (RR)' }
  ];

  return (
    <div className="app-container">
      <header className="header glass">
        <div className="logo">
          <RefreshCw className="logo-icon" />
          <h1 className="gradient-text">Visualizador de Escalonamento de SO</h1>
        </div>
        <p className="subtitle">Algoritmos Animados de Escalonamento de CPU</p>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div className="panel glass config-panel">
            <div className="panel-header">
              <Settings size={20} />
              <h2>Configuração</h2>
            </div>
            
            <div className="form-group">
              <label>Algoritmo</label>
              <CustomSelect 
                options={algOptions}
                value={algorithm}
                onChange={setAlgorithm}
                disabled={isPlaying}
              />
            </div>
            
            {algorithm === 'RR' && (
              <div className="form-group slide-down">
                <label>Quantum de Tempo</label>
                <input 
                  type="number" 
                  min="1" 
                  value={quantum}
                  onChange={(e) => setQuantum(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input-field"
                  disabled={isPlaying}
                />
              </div>
            )}
            
            <div className="form-group mt-2">
              <label>Velocidade da Animação: {playbackSpeed}ms / ciclo</label>
              <input 
                type="range" 
                min="100" 
                max="2000" 
                step="100"
                value={playbackSpeed} 
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="range-field"
              />
            </div>
            
            <div className="tasks-header">
              <h3>Processos</h3>
              <button onClick={addTask} className="btn btn-icon btn-add" title="Adicionar Processo" disabled={isPlaying}>
                <Plus size={16} />
              </button>
            </div>
            
            <div className="task-list">
              {tasks.length === 0 ? (
                <p className="empty-msg">Nenhum processo adicionado.</p>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="task-item glass">
                    <div className="task-id" style={{ backgroundColor: getTaskColor(task.id) }}>
                      P{task.id}
                    </div>
                    <div className="task-inputs">
                      <div className="input-group">
                        <label title="Tempo de Chegada">Chegada</label>
                        <input 
                          type="number" 
                          min="0"
                          value={task.arrivalTime} 
                          onChange={(e) => updateTask(task.id, 'arrivalTime', e.target.value)}
                          disabled={isPlaying}
                        />
                      </div>
                      <div className="input-group">
                        <label title="Tempo de Execução (Burst)">Execução</label>
                        <input 
                          type="number" 
                          min="1"
                          value={task.burstTime} 
                          onChange={(e) => updateTask(task.id, 'burstTime', e.target.value)}
                          disabled={isPlaying}
                        />
                      </div>
                    </div>
                    <button onClick={() => removeTask(task.id)} className="btn-remove" disabled={isPlaying} title="Remover Processo">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        <main className="visualization-area">
          <div className="panel glass player-panel">
            <div className="player-controls">
              <button className="btn btn-player play-btn" onClick={togglePlay}>
                {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                <span>{isPlaying ? 'Pausar' : (currentTime > 0 && currentTime < totalTime ? 'Retomar' : 'Iniciar')}</span>
              </button>
              <button className="btn btn-player stop-btn" onClick={stopSimulation} disabled={currentTime === 0}>
                <Square fill="currentColor" size={16} />
                <span>Parar</span>
              </button>
            </div>
            
            <div className="time-display">
              <span className="time-label">Tempo:</span>
              <span className="time-value gradient-text">{currentTime}</span>
              {totalTime > 0 && <span className="time-total">/ {totalTime}</span>}
            </div>
          </div>

          {simulationData ? (
            <div className="animation-grid">
              {/* CPU Status */}
              <div className="panel glass animation-box cpu-box">
                <div className="panel-header">
                  <Cpu size={20} className={currentState.running ? 'pulse-icon text-accent' : ''} />
                  <h2>CPU</h2>
                </div>
                <div className="box-content">
                  {currentState.running ? (
                    <div className="active-process pulse" style={{ backgroundColor: getTaskColor(currentState.running) }}>
                      <span className="proc-label">Processo {currentState.running}</span>
                      <span className="proc-status">Executando...</span>
                    </div>
                  ) : (
                    <div className="idle-state">
                      <span className="idle-text">OCIOSO</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ready Queue */}
              <div className="panel glass animation-box queue-box">
                <div className="panel-header">
                  <List size={20} />
                  <h2>Fila de Prontos</h2>
                </div>
                <div className="box-content queue-content">
                  {currentState.queue.length > 0 ? (
                    currentState.queue.map((taskId, idx) => (
                      <div key={`${taskId}-${idx}`} className="queue-item slide-in" style={{ backgroundColor: getTaskColor(taskId) }}>
                        P{taskId}
                      </div>
                    ))
                  ) : (
                    <span className="empty-text">Fila vazia</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state glass">
              <Play size={48} className="pulse text-primary mb-4" />
              <h2>Configure e Inicie</h2>
              <p>Configure os processos e clique em Iniciar para ver a animação.</p>
            </div>
          )}

          {simulationData && (
            <div className="panel glass gantt-panel">
              <div className="panel-header">
                <BarChart2 size={20} />
                <h2>Linha do Tempo (Gantt)</h2>
              </div>
              
              <div className="gantt-chart-container">
                <div className="gantt-chart">
                  {simulationData.executionLog.map((block, index) => {
                    if (block.startTime >= currentTime) return null;
                    
                    const blockEndTime = Math.min(block.endTime, currentTime);
                    const widthPercent = ((blockEndTime - block.startTime) / totalTime) * 100;
                    
                    if (widthPercent <= 0) return null;

                    return (
                      <div 
                        key={index} 
                        className={`gantt-block ${block.isIdle ? 'idle' : ''}`}
                        style={{ 
                          width: `${((block.endTime - block.startTime) / totalTime) * 100}%`,
                          backgroundColor: block.isIdle ? 'transparent' : getTaskColor(block.taskId)
                        }}
                      >
                        <div 
                          className="gantt-fill"
                          style={{
                            width: `${(widthPercent / (((block.endTime - block.startTime) / totalTime) * 100)) * 100}%`,
                            backgroundColor: block.isIdle ? 'transparent' : getTaskColor(block.taskId)
                          }}
                        />
                        <div className="gantt-content">
                          <span className="block-label">
                            {block.isIdle ? 'Ocioso' : `P${block.taskId}`}
                          </span>
                        </div>
                        {block.startTime === 0 && <span className="block-time start">0</span>}
                        {blockEndTime === block.endTime && <span className="block-time end slide-in">{block.endTime}</span>}
                      </div>
                    );
                  })}
                </div>
                <div 
                  className="progress-line" 
                  style={{ left: `${(currentTime / totalTime) * 100}%` }}
                />
              </div>
            </div>
          )}

          {simulationData && (
            <div className="panel glass metrics-panel">
              <div className="panel-header">
                <CheckCircle size={20} />
                <h2>Processos Concluídos</h2>
              </div>
              
              <div className="table-responsive">
                <table className="metrics-table">
                  <thead>
                    <tr>
                      <th>Processo</th>
                      <th>Status</th>
                      <th>Conclusão</th>
                      <th>Turnaround</th>
                      <th>Espera</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulationData.results.sort((a,b)=>a.id - b.id).map(task => {
                      const isCompleted = currentState.completed.includes(task.id);
                      return (
                        <tr key={task.id} className={isCompleted ? 'row-completed slide-in' : 'row-pending'}>
                          <td>
                            <div className="process-badge" style={{ backgroundColor: getTaskColor(task.id) }}>
                              P{task.id}
                            </div>
                          </td>
                          <td>
                            {isCompleted ? <span className="status-badge done">Concluído</span> : 
                             currentState.running === task.id ? <span className="status-badge running">Executando</span> : 
                             currentState.queue.includes(task.id) ? <span className="status-badge waiting">Aguardando</span> : 
                             <span className="status-badge pending">Pendente</span>}
                          </td>
                          <td>{isCompleted ? task.completionTime : '-'}</td>
                          <td>{isCompleted ? task.turnaroundTime : '-'}</td>
                          <td>{isCompleted ? task.waitingTime : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
