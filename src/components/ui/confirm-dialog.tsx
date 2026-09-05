"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "确认操作",
  description = "此操作不可撤销，请确认是否继续。",
  confirmText = "确认",
  cancelText = "取消",
  variant = "destructive",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {variant === "destructive" && (
              <AlertTriangle className="size-5 text-destructive shrink-0" />
            )}
            <DialogTitle>{title}</DialogTitle>
          </div>
          {description && (
            <DialogDescription className="pt-2 text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant}
            size="sm"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
