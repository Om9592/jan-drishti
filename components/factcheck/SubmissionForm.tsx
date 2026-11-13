"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { submissionSchema, type SubmissionPayload } from "@/lib/validation/schemas";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { clientStorage, firebaseClientReady } from "@/lib/firebase/client";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { cn } from "@/lib/utils";

type SubmissionType = "viral_claim" | "news_tip" | "correction_request";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function SubmissionForm({
  type = "viral_claim",
  reference,
  onTypeChange,
}: {
  type?: SubmissionType;
  reference?: string;
  onTypeChange?: (type: SubmissionType) => void;
}) {
  const { t, lang } = useLanguage();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ reference: string; note: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageNote, setImageNote] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubmissionPayload>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      type,
      language: lang,
      content: "",
      url: "",
      claimedSource: "",
      contactEmail: "",
      submitterName: "",
      consent: undefined as unknown as true,
      imageUrl: reference ? "" : "",
    },
  });

  async function uploadImage(file: File) {
    setImageNote(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageNote("Only PNG, JPEG or WebP images are accepted.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageNote("Images must be smaller than 5 MB.");
      return;
    }
    if (!firebaseClientReady()) {
      setImageNote(
        "Screenshot upload needs Firebase Storage to be configured. You can still submit the text of the claim.",
      );
      return;
    }
    setUploading(true);
    try {
      const storage = clientStorage();
      const path = `submissions/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type });
      const url = await getDownloadURL(fileRef);
      setImageUrl(url);
      setImageNote("Screenshot attached.");
    } catch {
      setImageNote("Upload failed. Submit the claim text without the image, or try again.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: SubmissionPayload) {
    setServerError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, type, imageUrl: imageUrl ?? "" }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        reference?: string;
        note?: string;
        error?: string;
        fields?: Record<string, string>;
      };
      if (!res.ok || !data.ok) {
        setServerError(data.error ?? t("factCheck.form.error"));
        return;
      }
      setSuccess({ reference: data.reference ?? "", note: data.note ?? "" });
      reset();
      setImageUrl(null);
    } catch {
      setServerError(t("factCheck.form.error"));
    }
  }

  if (success) {
    return (
      <div className="border border-verdict-true/30 bg-verdict-true/[0.05] p-6">
        <CheckCircle2 className="h-6 w-6 text-verdict-true" aria-hidden="true" />
        <h3 className="mt-3 font-serif text-[1.25rem] text-navy">{t("factCheck.form.success")}</h3>
        <p className="mt-2 font-sans text-[0.85rem] leading-relaxed text-ink-soft">
          {t("factCheck.form.successDetail", { ref: success.reference })}
        </p>
        {success.note && (
          <p className="mt-2 border-l border-gold pl-2.5 font-sans text-[0.75rem] leading-relaxed text-ink-muted">
            {success.note}
          </p>
        )}
        <button
          type="button"
          onClick={() => setSuccess(null)}
          className="mt-4 border-b border-gold pb-0.5 font-sans text-[0.68rem] uppercase tracking-[0.1em] text-navy hover:text-gold-dark"
        >
          {t("factCheck.formHeading")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {onTypeChange && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["viral_claim", t("submit.tabClaim")],
              ["news_tip", t("submit.tabTip")],
              ["correction_request", t("submit.tabCorrection")],
            ] as [SubmissionType, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onTypeChange(value)}
              className={cn(
                "border px-3 py-1.5 font-sans text-[0.66rem] uppercase tracking-[0.08em] transition-colors",
                type === value
                  ? "border-navy bg-navy text-paper"
                  : "border-rule text-ink-soft hover:border-navy hover:text-navy",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div>
        <label htmlFor="content" className="field-label">
          {type === "news_tip" ? t("submit.tabTip") : type === "correction_request" ? t("submit.tabCorrection") : t("factCheck.form.content")}{" "}
          <span className="text-verdict-false">*</span>
        </label>
        <textarea
          id="content"
          rows={6}
          {...register("content")}
          placeholder={
            type === "news_tip"
              ? t("submit.tipHint")
              : type === "correction_request"
                ? t("submit.correctionHint")
                : t("factCheck.form.contentHint")
          }
          aria-invalid={Boolean(errors.content)}
          aria-describedby={errors.content ? "content-error" : "content-hint"}
          className="field resize-y"
        />
        <div className="mt-1 flex items-start justify-between gap-3">
          <p id="content-hint" className="font-sans text-[0.68rem] leading-relaxed text-ink-muted">
            {t("factCheck.form.contentHint")}
          </p>
        </div>
        {errors.content && (
          <p id="content-error" className="mt-1 flex items-center gap-1 font-sans text-[0.7rem] text-verdict-false">
            <AlertCircle className="h-3 w-3" aria-hidden="true" /> {errors.content.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="url" className="field-label">
            {t("factCheck.form.url")} <span className="text-ink-muted">({t("common.optional")})</span>
          </label>
          <input id="url" type="url" {...register("url")} placeholder="https://" className="field" />
          {errors.url && <p className="mt-1 font-sans text-[0.7rem] text-verdict-false">{errors.url.message}</p>}
        </div>
        <div>
          <label htmlFor="claimedSource" className="field-label">
            {t("factCheck.form.source")} <span className="text-ink-muted">({t("common.optional")})</span>
          </label>
          <input
            id="claimedSource"
            {...register("claimedSource")}
            placeholder={lang === "hi" ? "जैसे: व्हाट्सएप ग्रुप, फ़ेसबुक पोस्ट" : "e.g. WhatsApp group, Facebook post"}
            className="field"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="submitterName" className="field-label">
            {t("common.name")} <span className="text-ink-muted">({t("common.optional")})</span>
          </label>
          <input id="submitterName" {...register("submitterName")} className="field" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="contactEmail" className="field-label">
            {t("factCheck.form.contact")}
          </label>
          <input id="contactEmail" type="email" {...register("contactEmail")} className="field" autoComplete="email" />
          {errors.contactEmail && (
            <p className="mt-1 font-sans text-[0.7rem] text-verdict-false">{errors.contactEmail.message}</p>
          )}
        </div>
      </div>

      <div>
        <span className="field-label">{t("factCheck.form.screenshot")}</span>
        {imageUrl ? (
          <div className="flex items-center justify-between border border-verdict-true/40 bg-verdict-true/[0.05] px-3 py-2">
            <span className="font-sans text-[0.75rem] text-ink-soft">Screenshot attached</span>
            <button
              type="button"
              onClick={() => {
                setImageUrl(null);
                setImageNote(null);
              }}
              className="text-ink-muted hover:text-navy"
              aria-label="Remove screenshot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 border border-dashed border-rule-strong px-3 py-3 font-sans text-[0.75rem] text-ink-muted hover:border-navy hover:text-navy">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
            )}
            {uploading ? "Uploading…" : "PNG, JPEG or WebP · max 5 MB"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadImage(file);
              }}
            />
          </label>
        )}
        {imageNote && <p className="mt-1 font-sans text-[0.7rem] leading-relaxed text-ink-muted">{imageNote}</p>}
      </div>

      <div className="border-t border-rule pt-3">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            {...register("consent")}
            className="mt-0.5 h-4 w-4 shrink-0 border border-rule-strong accent-navy"
          />
          <span className="font-sans text-[0.75rem] leading-relaxed text-ink-soft">{t("factCheck.form.consent")}</span>
        </label>
        {errors.consent && (
          <p className="mt-1 flex items-center gap-1 font-sans text-[0.7rem] text-verdict-false">
            <AlertCircle className="h-3 w-3" aria-hidden="true" /> {errors.consent.message}
          </p>
        )}
      </div>

      {serverError && (
        <div className="border border-verdict-false/30 bg-verdict-false/[0.05] px-3 py-2">
          <p className="font-sans text-[0.78rem] text-verdict-false">{serverError}</p>
        </div>
      )}

      <button type="submit" disabled={isSubmitting} className="btn-primary w-full sm:w-auto">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? t("common.sending") : t("factCheck.form.submit")}
      </button>

      <p className="font-sans text-[0.68rem] leading-relaxed text-ink-muted">{t("submit.privacy")}</p>
    </form>
  );
}
