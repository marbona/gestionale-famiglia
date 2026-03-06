import json
import os
import time
import uuid
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from threading import Lock
from typing import Any, Callable

from sqlalchemy.orm import Session

from . import crud


@dataclass
class ChatSessionState:
    created_at: float
    last_access: float
    messages: list[dict[str, str]] = field(default_factory=list)


class AIChatService:
    def __init__(self):
        self._sessions: dict[str, ChatSessionState] = {}
        self._lock = Lock()

    @property
    def enabled(self) -> bool:
        return os.getenv("AI_CHAT_ENABLED", "true").lower() == "true"

    @property
    def base_url(self) -> str:
        return os.getenv("OLLAMA_BASE_URL", "http://192.168.69.51:11434").rstrip("/")

    @property
    def model(self) -> str:
        return os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

    @property
    def timeout_seconds(self) -> int:
        return int(os.getenv("AI_CHAT_TIMEOUT_SECONDS", "45"))

    @property
    def max_turns(self) -> int:
        return max(5, int(os.getenv("AI_CHAT_MAX_TURNS", "20")))

    @property
    def session_ttl_minutes(self) -> int:
        return max(5, int(os.getenv("AI_CHAT_SESSION_TTL_MINUTES", "120")))

    def _cleanup_expired_sessions(self) -> None:
        ttl_seconds = self.session_ttl_minutes * 60
        now = time.time()
        expired_ids = [sid for sid, state in self._sessions.items() if (now - state.last_access) > ttl_seconds]
        for sid in expired_ids:
            self._sessions.pop(sid, None)

    def _create_session_unlocked(self) -> str:
        session_id = str(uuid.uuid4())
        now = time.time()
        self._sessions[session_id] = ChatSessionState(created_at=now, last_access=now)
        return session_id

    def create_session(self) -> str:
        with self._lock:
            self._cleanup_expired_sessions()
            return self._create_session_unlocked()

    def _get_or_create_session(self, session_id: str | None) -> tuple[str, ChatSessionState]:
        with self._lock:
            self._cleanup_expired_sessions()
            if not session_id or session_id not in self._sessions:
                session_id = self._create_session_unlocked()
            session = self._sessions[session_id]
            session.last_access = time.time()
            return session_id, session

    def _append_session_message(self, session_id: str, role: str, content: str) -> None:
        with self._lock:
            if session_id not in self._sessions:
                return
            state = self._sessions[session_id]
            state.messages.append({"role": role, "content": content})
            max_messages = self.max_turns * 2
            if len(state.messages) > max_messages:
                state.messages = state.messages[-max_messages:]
            state.last_access = time.time()

    def _call_ollama(self, messages: list[dict[str, str]], *, force_json: bool = False) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "stream": False,
            "messages": messages,
            "options": {
                "temperature": 0.25,
            },
        }
        if force_json:
            payload["format"] = "json"

        req = urllib.request.Request(
            url=f"{self.base_url}/api/chat",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Ollama HTTP error {exc.code}: {detail}")
        except Exception as exc:
            raise RuntimeError(f"Ollama connection error: {exc}")

        try:
            parsed = json.loads(body)
            return parsed["message"]["content"]
        except Exception as exc:
            raise RuntimeError(f"Invalid Ollama response: {exc}")

    @staticmethod
    def _extract_json_object(text: str) -> dict[str, Any] | None:
        text = text.strip()
        if not text:
            return None

        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None

        maybe = text[start : end + 1]
        try:
            parsed = json.loads(maybe)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None

        return None

    def health(self) -> dict[str, Any]:
        if not self.enabled:
            return {
                "enabled": False,
                "reachable": False,
                "model": self.model,
                "model_available": False,
                "detail": "AI chat disabled by AI_CHAT_ENABLED=false",
            }

        try:
            with urllib.request.urlopen(f"{self.base_url}/api/tags", timeout=8) as response:
                payload = json.loads(response.read().decode("utf-8"))
            models = payload.get("models", [])
            model_available = any(m.get("name") == self.model or m.get("model") == self.model for m in models)
            return {
                "enabled": True,
                "reachable": True,
                "model": self.model,
                "model_available": model_available,
                "detail": None if model_available else "Model not found in Ollama tags",
            }
        except Exception as exc:
            return {
                "enabled": True,
                "reachable": False,
                "model": self.model,
                "model_available": False,
                "detail": str(exc),
            }

    def _build_tool_functions(self, db: Session) -> dict[str, Callable[..., dict[str, Any]]]:
        def monthly_summary(year: int, month: int) -> dict[str, Any]:
            summary = crud.get_monthly_summary(db, year=year, month=month)
            return summary.model_dump()

        def yearly_summary(year: int) -> dict[str, Any]:
            summary = crud.get_yearly_summary(db, year=year)
            return summary.model_dump()

        def category_breakdown(year: int, month: int) -> dict[str, Any]:
            summary = crud.get_monthly_summary(db, year=year, month=month).model_dump()
            category_pairs = sorted(
                summary.get("expenses_by_category", {}).items(),
                key=lambda item: item[1],
                reverse=True,
            )
            return {
                "year": year,
                "month": month,
                "total_expenses": summary.get("total_expenses", 0),
                "expenses_by_category": [{"category": k, "amount": v} for k, v in category_pairs],
            }

        def month_compare(year_a: int, month_a: int, year_b: int, month_b: int) -> dict[str, Any]:
            a = crud.get_monthly_summary(db, year=year_a, month=month_a).model_dump()
            b = crud.get_monthly_summary(db, year=year_b, month=month_b).model_dump()
            return {
                "month_a": {
                    "year": year_a,
                    "month": month_a,
                    "total_income": a["total_income"],
                    "total_expenses": a["total_expenses"],
                    "balance": a["balance"],
                },
                "month_b": {
                    "year": year_b,
                    "month": month_b,
                    "total_income": b["total_income"],
                    "total_expenses": b["total_expenses"],
                    "balance": b["balance"],
                },
                "differences": {
                    "income": b["total_income"] - a["total_income"],
                    "expenses": b["total_expenses"] - a["total_expenses"],
                    "balance": b["balance"] - a["balance"],
                },
            }

        def large_advances_balance() -> dict[str, Any]:
            return crud.get_large_advances_balance(db)

        def major_expenses_by_year(year: int) -> dict[str, Any]:
            expenses = crud.get_major_expenses_by_year(db, year=year, skip=0, limit=1000)
            total = sum(float(item.amount) for item in expenses)
            by_category: dict[str, float] = {}
            for item in expenses:
                by_category[item.category] = by_category.get(item.category, 0.0) + float(item.amount)
            categories_sorted = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)
            return {
                "year": year,
                "count": len(expenses),
                "total": total,
                "by_category": [{"category": k, "amount": v} for k, v in categories_sorted],
            }

        return {
            "monthly_summary": monthly_summary,
            "yearly_summary": yearly_summary,
            "category_breakdown": category_breakdown,
            "month_compare": month_compare,
            "large_advances_balance": large_advances_balance,
            "major_expenses_by_year": major_expenses_by_year,
        }

    def _coerce_int(self, value: Any) -> int:
        if isinstance(value, bool):
            raise ValueError("Invalid integer value")
        return int(value)

    def _execute_tool(self, db: Session, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        tools = self._build_tool_functions(db)
        if tool_name not in tools:
            raise ValueError(f"Unsupported tool: {tool_name}")

        fn = tools[tool_name]
        if tool_name in {
            "monthly_summary",
            "yearly_summary",
            "category_breakdown",
            "major_expenses_by_year",
            "month_compare",
        }:
            for key in [k for k in arguments.keys() if k.startswith("year")]:
                arguments[key] = self._coerce_int(arguments[key])
            for key in [k for k in arguments.keys() if k.startswith("month")]:
                arguments[key] = self._coerce_int(arguments[key])

        return fn(**arguments)

    def _build_planner_prompt(self) -> str:
        return (
            "Sei un orchestratore tool per un assistente finanziario familiare. "
            "Decidi se serve usare un tool per rispondere alla richiesta utente.\n"
            "Tool disponibili:\n"
            "- monthly_summary(year, month)\n"
            "- yearly_summary(year)\n"
            "- category_breakdown(year, month)\n"
            "- month_compare(year_a, month_a, year_b, month_b)\n"
            "- large_advances_balance()\n"
            "- major_expenses_by_year(year)\n"
            "Rispondi SOLO con JSON valido, senza markdown, formato:\n"
            "{\"action\":\"tool_call\",\"tool_name\":\"...\",\"arguments\":{...}}\n"
            "oppure\n"
            "{\"action\":\"answer\",\"answer\":\"...\"}\n"
            "Regole: se l'utente chiede dati numerici, trend, confronti o categorie, usa sempre tool_call."
        )

    def _build_answer_prompt(self, now_iso: str, tool_results: list[dict[str, Any]]) -> str:
        tool_payload = json.dumps(tool_results, ensure_ascii=False)
        return (
            "Sei un assistente esperto di contabilità familiare. "
            f"Data attuale: {now_iso}. "
            "Rispondi in italiano, in modo pratico e chiaro. "
            "Dai consigli concreti e motivati, ma evita toni assoluti. "
            "Usa SOLO i dati tool forniti quando citi numeri.\n"
            f"TOOL_RESULTS={tool_payload}"
        )

    def _build_chart_specs(self, used_tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not used_tools:
            return []

        last = used_tools[-1]
        name = last.get("tool_name")
        result = last.get("result", {})

        if name == "yearly_summary":
            months = result.get("months", [])
            return [
                {
                    "type": "line",
                    "title": f"Andamento Bilancio {result.get('year', '')}",
                    "data": [
                        {"label": item.get("label", ""), "value": float(item.get("balance", 0.0))}
                        for item in months
                    ],
                }
            ]

        if name in {"category_breakdown", "major_expenses_by_year"}:
            points = result.get("expenses_by_category") or result.get("by_category") or []
            return [
                {
                    "type": "pie",
                    "title": "Distribuzione per categoria",
                    "data": [
                        {"label": item.get("category", "N/A"), "value": float(item.get("amount", 0.0))}
                        for item in points[:10]
                    ],
                }
            ]

        if name == "month_compare":
            month_a = result.get("month_a", {})
            month_b = result.get("month_b", {})
            label_a = f"{self._coerce_int(month_a.get('month', 0)):02d}/{month_a.get('year', '')}"
            label_b = f"{self._coerce_int(month_b.get('month', 0)):02d}/{month_b.get('year', '')}"
            return [
                {
                    "type": "bar",
                    "title": "Confronto Spese Mensili",
                    "data": [
                        {"label": label_a, "value": float(month_a.get("total_expenses", 0.0))},
                        {"label": label_b, "value": float(month_b.get("total_expenses", 0.0))},
                    ],
                }
            ]

        if name == "monthly_summary":
            by_category = result.get("expenses_by_category", {})
            sorted_points = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)
            return [
                {
                    "type": "pie",
                    "title": f"Spese per Categoria {int(result.get('month', 0)):02d}/{result.get('year', '')}",
                    "data": [{"label": k, "value": float(v)} for k, v in sorted_points[:10]],
                }
            ]

        if name == "large_advances_balance":
            return [
                {
                    "type": "bar",
                    "title": "Contributi Grossi Anticipi",
                    "data": [
                        {"label": "Marco", "value": float(result.get("marco_total", 0.0))},
                        {"label": "Anna", "value": float(result.get("anna_total", 0.0))},
                    ],
                }
            ]

        return []

    def process_message(self, db: Session, session_id: str | None, user_message: str) -> dict[str, Any]:
        if not self.enabled:
            raise RuntimeError("AI chat is disabled")

        resolved_session_id, session = self._get_or_create_session(session_id)

        user_message = (user_message or "").strip()
        if not user_message:
            raise ValueError("message cannot be empty")

        history = list(session.messages)

        planner_messages: list[dict[str, str]] = [{"role": "system", "content": self._build_planner_prompt()}]
        planner_messages.extend(history)
        planner_messages.append({"role": "user", "content": user_message})

        used_tools: list[dict[str, Any]] = []
        direct_answer: str | None = None

        for _ in range(2):
            planner_raw = self._call_ollama(planner_messages, force_json=True)
            planner_json = self._extract_json_object(planner_raw) or {}
            action = planner_json.get("action")

            if action == "answer":
                direct_answer = str(planner_json.get("answer", "")).strip()
                break

            if action != "tool_call":
                break

            tool_name = str(planner_json.get("tool_name", "")).strip()
            arguments = planner_json.get("arguments", {})
            if not isinstance(arguments, dict):
                arguments = {}

            try:
                tool_result = self._execute_tool(db, tool_name, arguments)
            except Exception as exc:
                tool_result = {"error": str(exc)}

            used_tools.append(
                {
                    "tool_name": tool_name,
                    "arguments": arguments,
                    "result": tool_result,
                }
            )

            planner_messages.append({"role": "assistant", "content": json.dumps(planner_json, ensure_ascii=False)})
            planner_messages.append(
                {
                    "role": "user",
                    "content": (
                        "Risultato tool eseguito (JSON): "
                        + json.dumps({"tool_name": tool_name, "result": tool_result}, ensure_ascii=False)
                        + "\nSe hai abbastanza dati, ora rispondi con action=answer."
                    ),
                }
            )

        if direct_answer:
            assistant_text = direct_answer
        else:
            now_iso = datetime.utcnow().strftime("%Y-%m-%d")
            answer_messages: list[dict[str, str]] = [
                {"role": "system", "content": self._build_answer_prompt(now_iso, used_tools)},
            ]
            answer_messages.extend(history)
            answer_messages.append({"role": "user", "content": user_message})
            assistant_text = self._call_ollama(answer_messages, force_json=False).strip()

        self._append_session_message(resolved_session_id, "user", user_message)
        self._append_session_message(resolved_session_id, "assistant", assistant_text)

        return {
            "session_id": resolved_session_id,
            "answer": assistant_text,
            "charts": self._build_chart_specs(used_tools),
            "used_tools": [{"tool_name": item["tool_name"], "arguments": item["arguments"]} for item in used_tools],
        }


service = AIChatService()
