"use client";
import { useState } from "react";
import { updateNameAction } from "../../actions";

export default function ProfileHead({ name, email, customerCode }: { name: string; email: string; customerCode: string }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const initial = (name || email || "B").trim().charAt(0).toUpperCase();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(customerCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { }
  };
  return (
    <div className="prof-head">
      <div className="prof-avatar">{initial}</div>
      <div style={{ minWidth: 0 }}>
        {editing ? (
          <form action={updateNameAction} className="prof-edit" onSubmit={() => setEditing(false)}>
            <input name="name" defaultValue={name} required minLength={2} maxLength={60} autoFocus aria-label="Tên hiển thị" />
            <button className="btn btn-primary btn-sm" type="submit">Lưu</button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(false)}>Huỷ</button>
          </form>
        ) : (
          <div className="prof-name">
            {name}
            <button type="button" className="prof-icon-btn" onClick={() => setEditing(true)} aria-label="Sửa tên">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
            </button>
          </div>
        )}
        <div className="prof-id">
          ID: <b>{customerCode}</b>
          <button type="button" className="prof-icon-btn" onClick={copy} aria-label="Chép mã khách" style={{ width: 26, height: 26 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          </button>
          {copied && <span style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>Đã chép</span>}
        </div>
        <div className="prof-mail">{email}</div>
      </div>
    </div>
  );
}
