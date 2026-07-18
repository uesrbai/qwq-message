import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/permissions";
import { getI18n } from "@/lib/i18n/server";
import { actionLabel } from "@/lib/audit-label";
import type { MethodKey } from "@/lib/constants";

const MAX_ROWS = 5000;

// 导出日志为 Excel：/api/export/logs?type=calls|ops&group=<分组编号>
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !canAccessFeature(user, "logs")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type") === "ops" ? "ops" : "calls";
  const group = url.searchParams.get("group") || undefined;

  const { locale, dict } = await getI18n();
  const d = dict.dashboard;
  const t = dict.logs;
  const fmt = (dt: Date) => dt.toLocaleString(locale === "zh" ? "zh-CN" : "en-US");

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  if (type === "ops") {
    const ws = wb.addWorksheet(t.opsTitle);
    ws.columns = [
      { header: d.colTime, key: "time", width: 22 },
      { header: t.colUser, key: "user", width: 16 },
      { header: t.colAction, key: "action", width: 20 },
      { header: t.colTarget, key: "target", width: 40 },
    ];
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
    for (const r of rows) {
      ws.addRow({
        time: fmt(r.createdAt),
        user: r.userName ?? "",
        action: actionLabel(dict, locale, r.action),
        target: r.target ?? "",
      });
    }
    ws.getRow(1).font = { bold: true };
  } else {
    const ws = wb.addWorksheet(t.callsTitle);
    ws.columns = [
      { header: d.colTime, key: "time", width: 22 },
      { header: d.colMethod, key: "method", width: 14 },
      { header: t.colGroup, key: "group", width: 16 },
      { header: d.colTemplate, key: "template", width: 16 },
      { header: t.colChannel, key: "channel", width: 20 },
      { header: d.colStatus, key: "status", width: 10 },
      { header: t.colLatency, key: "latency", width: 12 },
      { header: t.colSource, key: "source", width: 10 },
      { header: t.colError, key: "error", width: 40 },
      { header: t.colIp, key: "ip", width: 16 },
    ];
    const rows = await prisma.callLog.findMany({
      where: group ? { groupCode: group } : undefined,
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      include: { channel: true },
    });
    for (const r of rows) {
      ws.addRow({
        time: fmt(r.createdAt),
        method: dict.methods[r.method as MethodKey] ?? r.method,
        group: r.groupCode ?? "",
        template: r.templateCode ?? "",
        channel: r.channel?.name ?? "",
        status: r.status === "SUCCESS" ? d.success : d.failed,
        latency: r.latencyMs ?? "",
        source: r.source,
        error: r.errorMsg ?? "",
        ip: r.requestIp ?? "",
      });
    }
    ws.getRow(1).font = { bold: true };
  }

  const raw = await wb.xlsx.writeBuffer();
  const body = new Uint8Array(raw as ArrayBuffer);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${type === "ops" ? "operation-logs" : "call-logs"}${group ? `-${group}` : ""}-${stamp}.xlsx`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
