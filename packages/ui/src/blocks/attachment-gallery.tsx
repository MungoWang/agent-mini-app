"use client"

import {
  Attachment,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@monkey-mini-app/ui/components/attachment"

export type GalleryFile = { name: string; url?: string }

/**
 * Thumbnail grid of files with open/copy.
 * @when A record has N files/images and you show them as tiles, not a table.
 * @example
 * <AttachmentGallery files={[{ name: "log.txt", url: "https://…" }]} />
 * @family Discovery & inspect
 */
export function AttachmentGallery({ files }: { files: GalleryFile[] }) {
  return (
    <AttachmentGroup data-testid="attachment-gallery">
      {files.map((file) => (
        <Attachment key={file.name}>
          {file.url ? (
            <AttachmentMedia>
              <img src={file.url} alt={file.name} className="size-10 object-cover" />
            </AttachmentMedia>
          ) : null}
          <AttachmentContent>
            <AttachmentTitle>{file.name}</AttachmentTitle>
          </AttachmentContent>
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}
