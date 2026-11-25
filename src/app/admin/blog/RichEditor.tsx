"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";

export default function RichEditor({ name, initialHtml }: { name: string; initialHtml: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setTick] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Viết nội dung bài tại đây…" }),
    ],
    content: initialHtml || "",
    onUpdate: ({ editor: ed }) => {
      if (inputRef.current) inputRef.current.value = ed.getHTML();
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (inputRef.current) inputRef.current.value = editor.getHTML();
    const rerender = () => setTick((t) => t + 1);
    editor.on("selectionUpdate", rerender);
    editor.on("transaction", rerender);
    return () => { editor.off("selectionUpdate", rerender); editor.off("transaction", rerender); };
  }, [editor]);

  if (!editor) return <div className="rte-wrap"><div className="rte-loading">Đang tải trình soạn thảo…</div><input ref={inputRef} type="hidden" name={name} defaultValue={initialHtml} /></div>;

  const btn = (label: string, action: () => void, active = false, title?: string) => (
    <button type="button" className={`rte-btn${active ? " on" : ""}`} onClick={action} title={title ?? label}>{label}</button>
  );
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Địa chỉ link (https://…)", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };
  const setImage = () => {
    const url = window.prompt("Địa chỉ ảnh (https://…)");
    if (url?.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  return (
    <div className="rte-wrap">
      <div className="rte-toolbar">
        {btn("B", () => editor.chain().focus().toggleBold().run(), editor.isActive("bold"), "Đậm (Ctrl+B)")}
        {btn("I", () => editor.chain().focus().toggleItalic().run(), editor.isActive("italic"), "Nghiêng (Ctrl+I)")}
        {btn("U", () => editor.chain().focus().toggleUnderline().run(), editor.isActive("underline"), "Gạch chân (Ctrl+U)")}
        {btn("S", () => editor.chain().focus().toggleStrike().run(), editor.isActive("strike"), "Gạch ngang")}
        <span className="rte-sep" />
        {btn("H2", () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }), "Tiêu đề 2")}
        {btn("H3", () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }), "Tiêu đề 3")}
        {btn("¶", () => editor.chain().focus().setParagraph().run(), editor.isActive("paragraph"), "Đoạn văn")}
        <span className="rte-sep" />
        {btn("• DS", () => editor.chain().focus().toggleBulletList().run(), editor.isActive("bulletList"), "Danh sách chấm")}
        {btn("1. DS", () => editor.chain().focus().toggleOrderedList().run(), editor.isActive("orderedList"), "Danh sách số")}
        {btn("❝", () => editor.chain().focus().toggleBlockquote().run(), editor.isActive("blockquote"), "Trích dẫn")}
        {btn("—", () => editor.chain().focus().setHorizontalRule().run(), false, "Đường kẻ ngang")}
        <span className="rte-sep" />
        {btn("Link", setLink, editor.isActive("link"), "Chèn / sửa link")}
        {btn("Ảnh", setImage, false, "Chèn ảnh theo URL")}
        <span className="rte-sep" />
        {btn("⬅", () => editor.chain().focus().setTextAlign("left").run(), editor.isActive({ textAlign: "left" }), "Căn trái")}
        {btn("⬌", () => editor.chain().focus().setTextAlign("center").run(), editor.isActive({ textAlign: "center" }), "Căn giữa")}
        {btn("➡", () => editor.chain().focus().setTextAlign("right").run(), editor.isActive({ textAlign: "right" }), "Căn phải")}
        <span className="rte-sep" />
        {btn("↩", () => editor.chain().focus().undo().run(), false, "Hoàn tác")}
        {btn("↪", () => editor.chain().focus().redo().run(), false, "Làm lại")}
        {btn("Xoá ĐD", () => editor.chain().focus().clearNodes().unsetAllMarks().run(), false, "Xoá định dạng")}
      </div>
      <EditorContent editor={editor} className="rte-content" />
      <input ref={inputRef} type="hidden" name={name} defaultValue={initialHtml} />
    </div>
  );
}
