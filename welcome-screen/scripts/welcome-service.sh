#!/usr/bin/env bash
# 2026 迎新大屏服务启停脚本
# 用法: ./scripts/welcome-service.sh {start|stop|restart|status|build|logs}
#   start    启动生产服务（Web :3000 + API :3002，后台运行，日志写入 logs/service.log）
#   stop     停止服务并释放端口
#   restart  重启（改完代码重新 build 后用它上线）
#   status   查看运行状态
#   build    执行生产构建（不启动）
#   logs     跟随查看日志（Ctrl+C 退出）
set -euo pipefail
cd "$(dirname "$0")/.." # 进入 welcome-screen 目录

WEB_PORT="${WEB_PORT:-3000}"
API_PORT="${API_PORT:-3002}"
PID_FILE="logs/service.pid"
LOG_FILE="logs/service.log"

port_pids() { fuser "${WEB_PORT}/tcp" "${API_PORT}/tcp" 2>/dev/null || true; }

pid_alive() {
  [[ -f $PID_FILE ]] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ -n $pid ]] && kill -0 "$pid" 2>/dev/null
}

wait_ports() { # $1=期望状态 up|down，$2=最长等待秒数
  local want="$1" secs="${2:-30}" i=0
  while (( i < secs )); do
    if [[ $want == up ]]; then
      [[ -n $(port_pids) ]] && return 0
    else
      [[ -z $(port_pids) ]] && return 0
    fi
    sleep 1; (( i += 1 ))
  done
  return 1
}

do_start() {
  if pid_alive; then echo "已在运行 (PID $(cat "$PID_FILE"))"; exit 0; fi
  if [[ -n $(port_pids) ]]; then
    echo "端口 $WEB_PORT/$API_PORT 被其它进程占用: $(port_pids)"
    echo "如确认可停止，请先执行: $0 stop"
    exit 1
  fi
  [[ -d dist/server ]] || { echo "未发现构建产物，先执行: $0 build"; exit 1; }
  mkdir -p logs
  : > "$LOG_FILE"
  # setsid 独立进程组，停止时可整组回收 npm 及其子进程
  setsid nohup npm start >>"$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  if wait_ports up 30; then
    echo "启动成功 (PID $(cat "$PID_FILE")) Web=:$WEB_PORT API=:$API_PORT 日志=$LOG_FILE"
  else
    echo "启动超时，最近日志："; tail -n 20 "$LOG_FILE"; exit 1
  fi
}

do_stop() {
  if pid_alive; then
    local pid; pid="$(cat "$PID_FILE")"
    kill -TERM -- -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  fi
  # 兜底：清理仍占用端口的残留进程（含历史手工启动的实例）
  if [[ -n $(port_pids) ]]; then
    fuser -k "${WEB_PORT}/tcp" "${API_PORT}/tcp" 2>/dev/null || true
  fi
  if wait_ports down 10; then
    echo "已停止"
  else
    fuser -k -KILL "${WEB_PORT}/tcp" "${API_PORT}/tcp" 2>/dev/null || true
    sleep 1; echo "已停止（强制）"
  fi
  rm -f "$PID_FILE"
}

do_status() {
  if pid_alive; then
    echo "运行中 (PID $(cat "$PID_FILE")) 端口占用: $(port_pids | tr -s ' ')"
  elif [[ -n $(port_pids) ]]; then
    echo "非本脚本启动的进程占用端口: $(port_pids)"
  else
    echo "未运行"
  fi
  curl -s -o /dev/null -w "Web  :$WEB_PORT  HTTP %{http_code}\n" "http://127.0.0.1:${WEB_PORT}/" || true
  curl -s -o /dev/null -w "API  :$API_PORT  HTTP %{http_code}\n" "http://127.0.0.1:${API_PORT}/api/stats" || true
}

case "${1:-}" in
  start) do_start ;;
  stop) do_stop ;;
  restart) do_stop; do_start ;;
  status) do_status ;;
  build) npm run build ;;
  logs) mkdir -p logs; touch "$LOG_FILE"; tail -f "$LOG_FILE" ;;
  *) sed -n '2,8p' "$0"; exit 1 ;;
esac
