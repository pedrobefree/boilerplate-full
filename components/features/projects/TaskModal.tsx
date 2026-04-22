"use client";

import { useEffect, useState } from "react";
import { X, Clock, User, AlignLeft, MessageSquare, Type, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal, ModalOverlay, Dialog } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { createNote, getTaskNotes } from "@/app/actions/notes";
import { getAssignableMembers, updateTask } from "@/app/actions/tasks";
import { useToast } from "@/components/ui/Toast";
import type { ProjectTask } from "./ProjectTasks";

interface TaskModalProps {
    task: ProjectTask | null;
    isOpen: boolean;
    onClose: () => void;
    onTaskUpdated?: () => void | Promise<void>;
}

function formatTaskDate(dateValue: string | null) {
    if (!dateValue) {
        return "No date";
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
        return "No date";
    }

    return date.toLocaleDateString();
}

export const TaskModal = ({ task, isOpen, onClose, onTaskUpdated }: TaskModalProps) => {
    const [notes, setNotes] = useState<any[]>([]);
    const [newNote, setNewNote] = useState("");
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [members, setMembers] = useState<any[]>([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState<ProjectTask["status"]>("todo");
    const [priority, setPriority] = useState<ProjectTask["priority"]>("medium");
    const [dueDate, setDueDate] = useState("");
    const [assigneeId, setAssigneeId] = useState("");
    const { addToast } = useToast();
    const selectedAssignee = members.find((member) => member.id === assigneeId) || null;

    useEffect(() => {
        if (!task || !isOpen) {
            return;
        }

        setTitle(task.title);
        setDescription(task.description || "");
        setStatus(task.status);
        setPriority(task.priority);
        setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
        setAssigneeId(task.assignee?.id || "");

        void getTaskNotes(task.id).then((res) => {
            if (res.success && res.data) {
                setNotes(res.data);
            }
        });

        void getAssignableMembers(task.projectId).then((res) => {
            if (res.success && res.data) {
                setMembers(res.data);
            }
        });
    }, [task, isOpen]);

    const handleAddNote = async () => {
        if (!task || !newNote.trim()) return;

        setIsSubmittingNote(true);
        const res = await createNote(task.id, newNote);
        setIsSubmittingNote(false);

        if (res.success && res.data) {
            setNotes((prev) => [...prev, res.data]);
            setNewNote("");
            addToast({ title: "Success", description: "Note added", type: "success" });
        } else {
            addToast({ title: "Error", description: "Failed to add note", type: "error" });
        }
    };

    const handleSave = async () => {
        if (!task || !title.trim()) {
            return;
        }

        setIsSaving(true);
        const res = await updateTask(task.id, {
            title: title.trim(),
            description,
            status,
            priority,
            dueDate: dueDate || null,
            assigneeId: assigneeId || null,
        });
        setIsSaving(false);

        if (!res.success) {
            addToast({ title: "Error", description: res.error || "Failed to update task", type: "error" });
            return;
        }

        addToast({ title: "Success", description: "Task updated successfully", type: "success" });
        if (onTaskUpdated) {
            await onTaskUpdated();
        }
    };

    if (!task) return null;

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onClose} isDismissable>
            <Modal className="sm:max-w-3xl">
                <Dialog className="outline-none">
                    <div className="relative">
                        <div className="p-6 border-b border-gray-100 pr-16 bg-white rounded-t-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <Badge
                                    variant={priority === "high" ? "error" : priority === "medium" ? "warning" : "default"}
                                    className="capitalize"
                                >
                                    {priority} Priority
                                </Badge>
                                <Badge variant={status === "done" ? "success" : "default"}>
                                    {status === "in-progress" ? "In Progress" : status === "todo" ? "To Do" : "Done"}
                                </Badge>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Task details</h2>

                            <button
                                onClick={onClose}
                                className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto bg-white">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Type className="size-4 text-gray-400" /> Title
                                    </label>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Task title"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <User className="size-4 text-gray-400" /> Assignee
                                        </label>
                                        <select
                                            value={assigneeId}
                                            onChange={(e) => setAssigneeId(e.target.value)}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                        >
                                            <option value="">Unassigned</option>
                                            {members.map((member) => (
                                                <option key={member.id} value={member.id}>
                                                    {member.full_name || member.email || "Unnamed member"}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Avatar
                                                src={selectedAssignee?.avatar_url || null}
                                                alt={selectedAssignee?.full_name || "Unassigned"}
                                                initials={selectedAssignee?.full_name?.charAt(0).toUpperCase()}
                                                size="sm"
                                            />
                                            <span>{selectedAssignee?.full_name || selectedAssignee?.email || "Unassigned"}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Clock className="size-4 text-gray-400" /> Due Date
                                        </label>
                                        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                        <span className="text-xs text-gray-500">Current deadline: {formatTaskDate(task.dueDate)}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Status</label>
                                        <select
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as ProjectTask["status"])}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                        >
                                            <option value="todo">To Do</option>
                                            <option value="in-progress">In Progress</option>
                                            <option value="done">Done</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Flag className="size-4 text-gray-400" /> Priority
                                        </label>
                                        <select
                                            value={priority}
                                            onChange={(e) => setPriority(e.target.value as ProjectTask["priority"])}
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                        <AlignLeft className="size-4 text-gray-400" /> Description
                                    </h3>
                                    <TextArea
                                        value={description}
                                        onChange={setDescription}
                                        className="min-h-[120px]"
                                        placeholder="Describe the task..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <MessageSquare className="size-4 text-gray-400" /> Activity & Notes
                                </h3>

                                <div className="space-y-4 mb-4">
                                    {notes.length === 0 ? (
                                        <p className="text-sm text-gray-500 italic">No notes yet.</p>
                                    ) : (
                                        notes.map((note) => (
                                            <div key={note.id} className="flex gap-3 bg-gray-50 p-3 rounded-lg">
                                                <Avatar src={note.user?.avatar_url} size="xs" />
                                                <div className="text-sm">
                                                    <p className="font-bold text-gray-900">{note.user?.full_name || "Unknown User"}</p>
                                                    <p className="text-gray-700 mt-1">{note.note_body}</p>
                                                    <p className="text-xs text-gray-400 mt-2">{new Date(note.created_at).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <TextArea
                                        placeholder="Add a note or update..."
                                        value={newNote}
                                        onChange={setNewNote}
                                        className="min-h-[80px] text-sm resize-none"
                                    />
                                    <div className="flex justify-end">
                                        <Button size="sm" onClick={handleAddNote} isDisabled={isSubmittingNote || !newNote.trim()}>
                                            {isSubmittingNote ? "Saving..." : "Save Note"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3 rounded-b-xl">
                            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                            <Button size="sm" onClick={handleSave} isDisabled={isSaving || !title.trim()}>
                                {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
