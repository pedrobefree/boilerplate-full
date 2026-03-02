"use client";

import { X, Clock, User, AlignLeft, MessageSquare, History, Tag, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal, ModalOverlay, Dialog } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/Textarea";

interface Task {
    id: string;
    title: string;
    status: "todo" | "in-progress" | "done";
    priority: "low" | "medium" | "high";
    dueDate: string;
    assignee: string;
    description?: string;
    notes?: string;
}

interface TaskModalProps {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
}

import { createNote, getTaskNotes } from "@/app/actions/notes";
import { updateTask } from "@/app/actions/tasks";
import { useToast } from "@/components/ui/Toast";
import { useState, useEffect } from "react";

export const TaskModal = ({ task, isOpen, onClose }: TaskModalProps) => {
    const [notes, setNotes] = useState<any[]>([]);
    const [newNote, setNewNote] = useState("");
    const [isSubmittingNote, setIsSubmittingNote] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (task && isOpen) {
            getTaskNotes(task.id).then(res => {
                if (res.success && res.data) {
                    setNotes(res.data);
                }
            });
        }
    }, [task, isOpen]);

    const handleAddNote = async () => {
        if (!task || !newNote.trim()) return;

        setIsSubmittingNote(true);
        const res = await createNote(task.id, newNote);
        setIsSubmittingNote(false);

        if (res.success && res.data) {
            setNotes(prev => [...prev, res.data]);
            setNewNote("");
            addToast({ title: "Success", description: "Note added", type: "success" });
        } else {
            addToast({ title: "Error", description: "Failed to add note", type: "error" });
        }
    };

    if (!task) return null;

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onClose} isDismissable>
            <Modal className="sm:max-w-2xl">
                <Dialog className="outline-none">
                    <div className="relative">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 pr-16 bg-white rounded-t-xl">
                            <div className="flex items-center gap-3 mb-2">
                                <Badge
                                    variant={task.priority === "high" ? "error" : task.priority === "medium" ? "warning" : "default"}
                                    className="capitalize"
                                >
                                    {task.priority} Priority
                                </Badge>
                                <Badge variant={task.status === "done" ? "success" : "default"}>
                                    {task.status === "in-progress" ? "In Progress" : task.status === "todo" ? "To Do" : "Done"}
                                </Badge>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">{task.title}</h2>

                            <button
                                onClick={onClose}
                                className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto bg-white">
                            {/* Meta Info */}
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                        <User className="size-3" /> Assignee
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <Avatar src={task.assignee} size="sm" />
                                        <span className="text-sm font-medium text-gray-700">Unassigned</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                        <Clock className="size-3" /> Due Date
                                    </label>
                                    <span className="text-sm font-medium text-gray-700">{task.dueDate || "No date"}</span>
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                    <AlignLeft className="size-4 text-gray-400" /> Description
                                </h3>
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {task.description || "No description provided."}
                                </p>
                            </div>

                            {/* Notes Section */}
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

                        {/* Footer */}
                        <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3 rounded-b-xl">
                            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};

const ActivityItem = ({ user, action, target, time }: any) => (
    <div className="flex gap-3">
        <Avatar size="xs" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330" />
        <div className="text-xs">
            <p className="text-gray-900">
                <span className="font-bold">{user}</span> {action} <span className="font-bold text-brand-700">{target}</span>
            </p>
            <p className="text-gray-500 mt-1">{time}</p>
        </div>
    </div>
);
