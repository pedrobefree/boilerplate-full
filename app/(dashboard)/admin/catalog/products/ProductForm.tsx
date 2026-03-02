"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ProductWithDetails, upsertProduct } from "@/app/actions/products";
import { type Category } from "@/app/actions/categories";
import { type Tag } from "@/app/actions/tags";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { TextArea } from "@/components/ui/Textarea"; // Note: Checked component, it's TextArea
import { Select } from "@/components/ui/Select";
import { SelectItem } from "@/components/ui/SelectItem";
import { Toggle } from "@/components/ui/Toggle";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { ClientOnly } from "@/components/ui/ClientOnly";

interface ProductFormProps {
    categories: Category[];
    tags: Tag[];
    initialData?: ProductWithDetails | null;
}

export function ProductForm({ categories, tags, initialData }: ProductFormProps) {
    const { addToast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [name, setName] = useState(initialData?.name || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [active, setActive] = useState(initialData?.active ?? true);
    const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
    const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
        new Set(initialData?.tags?.map(t => t.tag_id) || [])
    );

    // Images
    const [imageUrls, setImageUrls] = useState<string[]>(
        initialData?.images?.sort((a, b) => a.display_order - b.display_order).map(i => i.url) || []
    );
    const [featuredIndex, setFeaturedIndex] = useState(initialData?.featured_image_index || 0);

    // Pricing (Simplified for now - assumes one main price)
    // If editing, try to find the first active price or just default to empty
    const mainPrice = initialData?.prices?.find(p => p.active) || initialData?.prices?.[0];
    const [priceAmount, setPriceAmount] = useState(mainPrice ? (mainPrice.unit_amount / 100).toString() : "");
    const [currency, setCurrency] = useState(mainPrice?.currency || "usd");
    const [priceType, setPriceType] = useState<"one_time" | "recurring">(mainPrice?.type === "recurring" ? "recurring" : "one_time");
    const [interval, setInterval] = useState<"day" | "week" | "month" | "year">(mainPrice?.interval || "month");
    const [intervalCount, setIntervalCount] = useState<number>(mainPrice?.interval_count || 1);
    const [trialPeriodDays, setTrialPeriodDays] = useState<number>(mainPrice?.trial_period_days || 0);

    // Handlers
    const handleTagToggle = (tagId: string) => {
        const next = new Set(selectedTagIds);
        if (next.has(tagId)) {
            next.delete(tagId);
        } else {
            next.add(tagId);
        }
        setSelectedTagIds(next);
    };

    const handleAddImageUrl = () => {
        setImageUrls([...imageUrls, ""]);
    };

    const handleImageUrlChange = (index: number, val: string) => {
        const next = [...imageUrls];
        next[index] = val;
        setImageUrls(next);
    };

    const handleRemoveImage = (index: number) => {
        const next = [...imageUrls];
        next.splice(index, 1);
        setImageUrls(next);
        if (featuredIndex >= next.length) {
            setFeaturedIndex(Math.max(0, next.length - 1));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await upsertProduct({
                id: initialData?.id,
                name,
                description,
                active,
                category_id: categoryId || undefined,
                featured_image_index: featuredIndex,
                images: imageUrls.filter(u => u.trim() !== ""),
                tag_ids: Array.from(selectedTagIds),
                price: priceAmount ? {
                    amount: parseFloat(priceAmount),
                    currency,
                    type: priceType,
                    interval: priceType === "recurring" ? interval : undefined,
                    interval_count: priceType === "recurring" ? intervalCount : undefined,
                    trial_period_days: priceType === "recurring" ? trialPeriodDays : undefined
                } : undefined
            });

            if (res.error) {
                addToast({ title: "Error", description: res.error, type: "error" });
            } else {
                addToast({ title: "Success", description: "Product saved successfully", type: "success" });
                router.push("/admin/catalog/products");
            }
        } catch (err) {
            console.error(err);
            addToast({ title: "Error", description: "Something went wrong", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ClientOnly fallback={<div className="space-y-6 max-w-4xl animate-pulse"><div className="h-12 bg-gray-100 rounded" /><div className="h-96 bg-gray-100 rounded-xl" /></div>}>
            <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/catalog/products">
                            <Button variant="tertiary" size="sm" type="button">
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {initialData ? "Edit Product" : "New Product"}
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button type="submit" isDisabled={isLoading}>
                            {isLoading ? "Saving..." : "Save Product"}
                        </Button>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <Tabs>
                        <div className="border-b border-gray-200 px-6 pt-4">
                            <Tabs.List type="underline">
                                <Tabs.Item id="general" label="General" />
                                <Tabs.Item id="pricing" label="Pricing" />
                                <Tabs.Item id="category" label="Category" />
                                <Tabs.Item id="media" label="Media" />
                            </Tabs.List>
                        </div>

                        <div className="p-6">
                            <Tabs.Panel id="general">
                                <div className="space-y-4 max-w-lg">
                                    <div className="flex justify-between items-start">
                                        <Input
                                            label="Product Name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="e.g. Premium Subscription"
                                            required
                                            className="flex-1"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Description</Label>
                                        <TextArea
                                            value={description}
                                            onChange={setDescription}
                                            placeholder="Product description..."
                                            rows={4}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Toggle
                                            label="Active Status"
                                            isSelected={active}
                                            onChange={setActive}
                                        />
                                        <p className="text-sm text-gray-500">
                                            Inactive products are hidden from the store.
                                        </p>
                                    </div>
                                </div>
                            </Tabs.Panel>

                            <Tabs.Panel id="pricing">
                                <div className="space-y-4 max-w-lg">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Input
                                            label="Price Amount"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={priceAmount}
                                            onChange={(e) => setPriceAmount(e.target.value)}
                                            prefix={<span className="text-gray-500 uppercase">{currency}</span>}
                                            placeholder="0.00"
                                        />
                                        <div className="space-y-1.5">
                                            <Label>Currency</Label>
                                            <Select selectedKey={currency} onSelectionChange={(k) => setCurrency(k as string)}>
                                                <SelectItem id="usd">USD</SelectItem>
                                                <SelectItem id="eur">EUR</SelectItem>
                                                <SelectItem id="brl">BRL</SelectItem>
                                                <SelectItem id="gbp">GBP</SelectItem>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label>Type</Label>
                                        <div className="flex gap-4 pt-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="priceType"
                                                    checked={priceType === "one_time"}
                                                    onChange={() => setPriceType("one_time")}
                                                    className="text-brand-600 focus:ring-brand-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">One-time</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="priceType"
                                                    checked={priceType === "recurring"}
                                                    onChange={() => setPriceType("recurring")}
                                                    className="text-brand-600 focus:ring-brand-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">Recurring</span>
                                            </label>
                                        </div>
                                    </div>

                                    {priceType === "recurring" && (
                                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="space-y-1.5">
                                                <Label>Billing Interval</Label>
                                                <Select selectedKey={interval} onSelectionChange={(k) => setInterval(k as any)}>
                                                    <SelectItem id="day">Daily</SelectItem>
                                                    <SelectItem id="week">Weekly</SelectItem>
                                                    <SelectItem id="month">Monthly</SelectItem>
                                                    <SelectItem id="year">Yearly</SelectItem>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Input
                                                    label="Interval Count"
                                                    type="number"
                                                    min="1"
                                                    value={intervalCount.toString()}
                                                    onChange={(e) => setIntervalCount(parseInt(e.target.value) || 1)}
                                                    placeholder="e.g. 1"
                                                />
                                            </div>
                                            <div className="col-span-2 space-y-1.5">
                                                <Input
                                                    label="Trial Period (Days)"
                                                    type="number"
                                                    min="0"
                                                    value={trialPeriodDays.toString()}
                                                    onChange={(e) => setTrialPeriodDays(parseInt(e.target.value) || 0)}
                                                    placeholder="e.g. 14"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Tabs.Panel>

                            <Tabs.Panel id="category">
                                <div className="space-y-6 max-w-lg">
                                    <div className="space-y-1.5">
                                        <Label>Category</Label>
                                        <Select
                                            selectedKey={categoryId}
                                            onSelectionChange={(k) => setCategoryId(k as string)}
                                            placeholder="Select a category"
                                        >
                                            {categories.map(cat => (
                                                <SelectItem id={cat.id} key={cat.id}>
                                                    {cat.parent ? `${cat.parent.name} > ${cat.name}` : cat.name}
                                                </SelectItem>
                                            ))}
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Tags</Label>
                                        <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg min-h-[60px]">
                                            {tags.map(tag => {
                                                const isSelected = selectedTagIds.has(tag.id);
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        onClick={() => handleTagToggle(tag.id)}
                                                        className={`
                                                        inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors border
                                                        ${isSelected
                                                                ? "bg-brand-50 border-brand-200 text-brand-700"
                                                                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                                                            }
                                                    `}
                                                    >
                                                        {tag.name}
                                                    </button>
                                                );
                                            })}
                                            {tags.length === 0 && (
                                                <span className="text-sm text-gray-400">No tags available.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Tabs.Panel>

                            <Tabs.Panel id="media">
                                <div className="space-y-4">
                                    <Label>Product Images (URLs)</Label>
                                    <div className="space-y-3">
                                        {imageUrls.map((url, index) => (
                                            <div key={index} className="flex gap-2 items-start">
                                                <div className="flex-1 space-y-1">
                                                    <Input
                                                        value={url}
                                                        onChange={(e) => handleImageUrlChange(index, e.target.value)}
                                                        placeholder="https://..."
                                                    />
                                                    {url && (
                                                        <div className="mt-2 h-32 w-32 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 relative group">
                                                            <img src={url} alt="Preview" className="h-full w-full object-cover" />
                                                            {featuredIndex === index && (
                                                                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                                                    <span className="bg-white/90 text-xs px-2 py-1 rounded-full font-semibold shadow-sm">Featured</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1 pt-1">
                                                    <Button
                                                        variant="tertiary"
                                                        size="sm"
                                                        onPress={() => handleRemoveImage(index)}
                                                        className="text-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                    <div className="flex flex-col items-center gap-1 mt-2">
                                                        <input
                                                            type="radio"
                                                            name="featuredImage"
                                                            checked={featuredIndex === index}
                                                            onChange={() => setFeaturedIndex(index)}
                                                            className="w-4 h-4 text-brand-600"
                                                        />
                                                        <span className="text-[10px] text-gray-500">Main</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Button variant="secondary" onPress={handleAddImageUrl} className="mt-2">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Image URL
                                    </Button>
                                </div>
                            </Tabs.Panel>
                        </div>
                    </Tabs>
                </div>
            </form>
        </ClientOnly>
    );
}
