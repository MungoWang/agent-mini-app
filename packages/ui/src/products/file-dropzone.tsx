"use client"

import { useDropzone } from "react-dropzone"

import { cn } from "@monkey-mini-app/ui/lib/utils"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"
import { Attachment, AttachmentContent, AttachmentTitle } from "@monkey-mini-app/ui/components/attachment"

export function FileDropzone({
  files,
  onFiles,
}: {
  files?: File[]
  onFiles?: (files: File[]) => void
}) {
  const t = useLabels("fileDropzone")
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => onFiles?.(accepted),
  })
  return (
    <div className="flex flex-col gap-2" data-testid="file-dropzone">
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground",
          isDragActive && "border-primary bg-muted/40"
        )}
      >
        <input {...getInputProps()} />
        {t.drop}
      </div>
      {files?.map((file) => (
        <Attachment key={file.name}>
          <AttachmentContent>
            <AttachmentTitle>{file.name}</AttachmentTitle>
          </AttachmentContent>
        </Attachment>
      ))}
    </div>
  )
}
