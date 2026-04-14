import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO;
const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "http://localhost:3000";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

type Recipient = string | string[] | null | undefined;

interface BaseEmailArgs {
    to: Recipient;
    subject: string;
    html: string;
    replyTo?: string;
}

interface EmailButton {
    label: string;
    href: string;
}

interface EmailLayoutArgs {
    title: string;
    preview?: string;
    intro: string;
    contentHtml: string;
    button?: EmailButton;
    outro?: string;
}

interface OrderEmailItem {
    name: string;
    quantity: number;
    unitAmount: number;
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function normalizeRecipients(to: Recipient) {
    const recipients = Array.isArray(to) ? to : [to];

    return Array.from(
        new Set(
            recipients
                .map((recipient) => recipient?.trim())
                .filter((recipient): recipient is string => Boolean(recipient))
        )
    );
}

function formatCurrency(amountInMinorUnits: number, currency: string) {
    const normalizedCurrency = currency?.toUpperCase() || "USD";
    const usesZeroDecimals = new Set(["JPY", "KRW"]);
    const divisor = usesZeroDecimals.has(normalizedCurrency) ? 1 : 100;

    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: normalizedCurrency,
    }).format(amountInMinorUnits / divisor);
}

function formatDateTime(date: Date | string) {
    const value = typeof date === "string" ? new Date(date) : date;

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(value);
}

function formatDate(date: Date | string) {
    const value = typeof date === "string" ? new Date(date) : date;

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
    }).format(value);
}

function buildEmailLayout({
    title,
    preview,
    intro,
    contentHtml,
    button,
    outro,
}: EmailLayoutArgs) {
    const previewHtml = preview
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>`
        : "";

    const buttonHtml = button
        ? `
            <div style="margin:24px 0;">
                <a
                    href="${button.href}"
                    style="display:inline-block;padding:12px 20px;background:#155EEF;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;"
                >
                    ${escapeHtml(button.label)}
                </a>
            </div>
        `
        : "";

    const outroHtml = outro
        ? `<p style="margin:24px 0 0;color:#475467;line-height:1.7;">${escapeHtml(outro)}</p>`
        : "";

    return `
        <!doctype html>
        <html lang="pt-BR">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>${escapeHtml(title)}</title>
            </head>
            <body style="margin:0;background:#F2F4F7;font-family:Inter,Arial,sans-serif;color:#101828;">
                ${previewHtml}
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;">
                    <tr>
                        <td align="center">
                            <table
                                role="presentation"
                                width="100%"
                                cellspacing="0"
                                cellpadding="0"
                                style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #EAECF0;"
                            >
                                <tr>
                                    <td style="padding:32px 32px 16px;background:linear-gradient(135deg,#155EEF,#004EEB);color:#ffffff;">
                                        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;">Befree Boilerplate</div>
                                        <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:32px;">
                                        <p style="margin:0 0 16px;color:#344054;line-height:1.7;">${escapeHtml(intro)}</p>
                                        ${contentHtml}
                                        ${buttonHtml}
                                        ${outroHtml}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:24px 32px;border-top:1px solid #EAECF0;color:#667085;font-size:12px;line-height:1.6;">
                                        Este email transacional foi enviado automaticamente pelo seu ambiente Befree.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
        </html>
    `;
}

function buildOrderItemsTable(items: OrderEmailItem[], currency: string) {
    const rows = items
        .map(
            (item) => `
                <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #EAECF0;color:#101828;">
                        ${escapeHtml(item.name)}
                    </td>
                    <td style="padding:12px 0;border-bottom:1px solid #EAECF0;color:#475467;text-align:center;">
                        ${item.quantity}
                    </td>
                    <td style="padding:12px 0;border-bottom:1px solid #EAECF0;color:#101828;text-align:right;">
                        ${escapeHtml(formatCurrency(item.unitAmount * item.quantity, currency))}
                    </td>
                </tr>
            `
        )
        .join("");

    return `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
            <thead>
                <tr>
                    <th style="padding-bottom:12px;text-align:left;color:#667085;font-size:12px;font-weight:600;">Item</th>
                    <th style="padding-bottom:12px;text-align:center;color:#667085;font-size:12px;font-weight:600;">Qtd.</th>
                    <th style="padding-bottom:12px;text-align:right;color:#667085;font-size:12px;font-weight:600;">Subtotal</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

export function buildAppUrl(path: string) {
    if (!path.startsWith("/")) {
        return `${APP_URL}/${path}`;
    }

    return `${APP_URL}${path}`;
}

export function isTransactionalEmailConfigured() {
    return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

export async function sendEmail({ to, subject, html, replyTo }: BaseEmailArgs) {
    const recipients = normalizeRecipients(to);

    if (recipients.length === 0) {
        return { success: false, skipped: true, reason: "No recipients" } as const;
    }

    if (!resend || !EMAIL_FROM) {
        console.warn("[email] Resend is not configured. Skipping email.", {
            recipients,
            subject,
        });
        return { success: false, skipped: true, reason: "Resend not configured" } as const;
    }

    await resend.emails.send({
        from: EMAIL_FROM,
        to: recipients,
        subject,
        html,
        replyTo: replyTo || EMAIL_REPLY_TO,
    });

    return { success: true, skipped: false } as const;
}

export async function safeSendEmail(args: BaseEmailArgs) {
    try {
        return await sendEmail(args);
    } catch (error) {
        console.error("[email] Failed to send transactional email", {
            subject: args.subject,
            to: normalizeRecipients(args.to),
            error,
        });
        return { success: false, skipped: false, reason: "send_failed" } as const;
    }
}

export async function sendInvitationEmail(args: {
    to: string;
    invitationUrl: string;
    organizationName: string;
    inviterName?: string | null;
    expiresInDays: number;
}) {
    const subject = `Você foi convidado para ${args.organizationName}`;
    const intro = args.inviterName
        ? `${args.inviterName} convidou você para entrar na organização ${args.organizationName}.`
        : `Você recebeu um convite para entrar na organização ${args.organizationName}.`;

    const html = buildEmailLayout({
        title: "Convite para organização",
        preview: subject,
        intro,
        contentHtml: `
            <p style="margin:0;color:#475467;line-height:1.7;">
                Use o botão abaixo para aceitar o convite. Este link expira em ${args.expiresInDays} dia(s).
            </p>
        `,
        button: {
            label: "Aceitar convite",
            href: args.invitationUrl,
        },
        outro: "Se você não estava esperando este convite, basta ignorar este email.",
    });

    return safeSendEmail({ to: args.to, subject, html });
}

export async function sendPasswordResetEmail(args: {
    to: string;
    resetUrl: string;
    recipientName?: string | null;
}) {
    const subject = "Redefina sua senha";
    const intro = args.recipientName
        ? `Olá, ${args.recipientName}. Recebemos uma solicitação para redefinir sua senha.`
        : "Recebemos uma solicitação para redefinir sua senha.";

    const html = buildEmailLayout({
        title: "Redefinição de senha",
        preview: subject,
        intro,
        contentHtml: `
            <p style="margin:0;color:#475467;line-height:1.7;">
                Para continuar, acesse o link seguro abaixo e defina uma nova senha para a sua conta.
            </p>
        `,
        button: {
            label: "Definir nova senha",
            href: args.resetUrl,
        },
        outro: "Se você não solicitou esta alteração, ignore este email. Sua conta permanecerá protegida.",
    });

    return safeSendEmail({ to: args.to, subject, html });
}

export async function sendCustomerWelcomeSetPasswordEmail(args: {
    to: string;
    resetUrl: string;
    recipientName?: string | null;
    orderNumber: string;
}) {
    const subject = "Sua conta foi criada. Defina sua primeira senha";
    const intro = args.recipientName
        ? `Olá, ${args.recipientName}. Criamos sua conta automaticamente após o pedido ${args.orderNumber}.`
        : `Criamos sua conta automaticamente após o pedido ${args.orderNumber}.`;

    const html = buildEmailLayout({
        title: "Ative o acesso da sua conta",
        preview: subject,
        intro,
        contentHtml: `
            <p style="margin:0;color:#475467;line-height:1.7;">
                Você já pode acessar sua área do cliente com o magic link exibido na confirmação da compra.
                Para não depender dele depois, defina agora sua primeira senha.
            </p>
        `,
        button: {
            label: "Criar minha senha",
            href: args.resetUrl,
        },
        outro: "Guarde este acesso para acompanhar pedidos e futuras compras.",
    });

    return safeSendEmail({ to: args.to, subject, html });
}

export async function sendOrderConfirmationEmail(args: {
    to: string;
    customerName?: string | null;
    orderNumber: string;
    items: OrderEmailItem[];
    totalAmount: number;
    currency: string;
    orderDate: Date | string;
    orderUrl?: string | null;
}) {
    const subject = `Pedido ${args.orderNumber} confirmado`;
    const intro = args.customerName
        ? `Olá, ${args.customerName}. Confirmamos o pagamento do seu pedido ${args.orderNumber}.`
        : `Confirmamos o pagamento do seu pedido ${args.orderNumber}.`;

    const html = buildEmailLayout({
        title: "Pagamento confirmado",
        preview: subject,
        intro,
        contentHtml: `
            <p style="margin:0 0 16px;color:#475467;line-height:1.7;">
                Data do pedido: <strong>${escapeHtml(formatDateTime(args.orderDate))}</strong><br />
                Total pago: <strong>${escapeHtml(formatCurrency(args.totalAmount, args.currency))}</strong>
            </p>
            ${buildOrderItemsTable(args.items, args.currency)}
        `,
        button: args.orderUrl
            ? {
                label: "Ver pedido",
                href: args.orderUrl,
            }
            : undefined,
    });

    return safeSendEmail({ to: args.to, subject, html });
}

export async function sendOrderCancelledEmail(args: {
    to: string;
    customerName?: string | null;
    orderNumber: string;
    orderUrl?: string | null;
    reason?: string | null;
    refundWindow?: string;
}) {
    const subject = `Pedido ${args.orderNumber} cancelado`;
    const intro = args.customerName
        ? `Olá, ${args.customerName}. O pedido ${args.orderNumber} foi cancelado.`
        : `O pedido ${args.orderNumber} foi cancelado.`;

    const reasonHtml = args.reason
        ? `<p style="margin:16px 0 0;color:#475467;line-height:1.7;">Motivo informado: <strong>${escapeHtml(args.reason)}</strong></p>`
        : "";

    const html = buildEmailLayout({
        title: "Cancelamento de pedido",
        preview: subject,
        intro,
        contentHtml: `
            <p style="margin:0;color:#475467;line-height:1.7;">
                Se houve cobrança, o estorno seguirá o prazo padrão da operadora${args.refundWindow ? `: <strong>${escapeHtml(args.refundWindow)}</strong>` : ""}.
            </p>
            ${reasonHtml}
        `,
        button: args.orderUrl
            ? {
                label: "Ver detalhes do pedido",
                href: args.orderUrl,
            }
            : undefined,
    });

    return safeSendEmail({ to: args.to, subject, html });
}

export async function sendProjectAssignedEmail(args: {
    to: string;
    recipientName?: string | null;
    projectName: string;
    organizationName: string;
    roleLabel: string;
    projectUrl?: string | null;
    assignedByName?: string | null;
}) {
    const subject = `Você foi adicionado ao projeto ${args.projectName}`;
    const intro = args.recipientName
        ? `Olá, ${args.recipientName}. Você foi adicionado ao projeto ${args.projectName}.`
        : `Você foi adicionado ao projeto ${args.projectName}.`;

    const assignedByHtml = args.assignedByName
        ? `<p style="margin:16px 0 0;color:#475467;line-height:1.7;">Atribuído por: <strong>${escapeHtml(args.assignedByName)}</strong></p>`
        : "";

    const html = buildEmailLayout({
        title: "Novo projeto atribuído",
        preview: subject,
        intro,
        contentHtml: `
            <p style="margin:0;color:#475467;line-height:1.7;">
                Organização: <strong>${escapeHtml(args.organizationName)}</strong><br />
                Papel no projeto: <strong>${escapeHtml(args.roleLabel)}</strong>
            </p>
            ${assignedByHtml}
        `,
        button: args.projectUrl
            ? {
                label: "Abrir projeto",
                href: args.projectUrl,
            }
            : undefined,
    });

    return safeSendEmail({ to: args.to, subject, html });
}

export async function sendTaskAssignedEmail(args: {
    to: string;
    recipientName?: string | null;
    taskTitle: string;
    projectName: string;
    status: string;
    dueDate?: string | null;
    taskUrl?: string | null;
    assignedByName?: string | null;
}) {
    const subject = `Nova tarefa atribuída: ${args.taskTitle}`;
    const intro = args.recipientName
        ? `Olá, ${args.recipientName}. Uma tarefa foi atribuída ao seu usuário.`
        : "Uma tarefa foi atribuída ao seu usuário.";

    const dueDateHtml = args.dueDate
        ? `<br />Prazo: <strong>${escapeHtml(formatDate(args.dueDate))}</strong>`
        : "";
    const assignedByHtml = args.assignedByName
        ? `<p style="margin:16px 0 0;color:#475467;line-height:1.7;">Atribuído por: <strong>${escapeHtml(args.assignedByName)}</strong></p>`
        : "";

    const html = buildEmailLayout({
        title: "Nova tarefa atribuída",
        preview: subject,
        intro,
        contentHtml: `
            <p style="margin:0;color:#475467;line-height:1.7;">
                Tarefa: <strong>${escapeHtml(args.taskTitle)}</strong><br />
                Projeto: <strong>${escapeHtml(args.projectName)}</strong><br />
                Status atual: <strong>${escapeHtml(args.status)}</strong>
                ${dueDateHtml}
            </p>
            ${assignedByHtml}
        `,
        button: args.taskUrl
            ? {
                label: "Abrir tarefa",
                href: args.taskUrl,
            }
            : undefined,
    });

    return safeSendEmail({ to: args.to, subject, html });
}

export async function sendAdminPaymentConfirmedEmail(args: {
    to: string[];
    recipientName?: string | null;
    organizationName: string;
    orderNumber: string;
    customerName?: string | null;
    totalAmount: number;
    currency: string;
    confirmedAt: Date | string;
    orderUrl?: string | null;
}) {
    const subject = `Pagamento confirmado para o pedido ${args.orderNumber}`;
    const intro = args.recipientName
        ? `Olá, ${args.recipientName}. Um novo pagamento foi confirmado em ${args.organizationName}.`
        : `Um novo pagamento foi confirmado em ${args.organizationName}.`;

    const customerLine = args.customerName
        ? `<br />Cliente: <strong>${escapeHtml(args.customerName)}</strong>`
        : "";

    const html = buildEmailLayout({
        title: "Pagamento confirmado",
        preview: subject,
        intro,
        contentHtml: `
            <p style="margin:0;color:#475467;line-height:1.7;">
                Pedido: <strong>${escapeHtml(args.orderNumber)}</strong>${customerLine}<br />
                Valor total: <strong>${escapeHtml(formatCurrency(args.totalAmount, args.currency))}</strong><br />
                Confirmado em: <strong>${escapeHtml(formatDateTime(args.confirmedAt))}</strong>
            </p>
        `,
        button: args.orderUrl
            ? {
                label: "Abrir pedido no admin",
                href: args.orderUrl,
            }
            : undefined,
    });

    return safeSendEmail({ to: args.to, subject, html });
}
