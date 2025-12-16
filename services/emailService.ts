
import emailjs from '@emailjs/browser';

// --- CONFIGURAÇÃO DO EMAILJS ---
const EMAILJS_CONFIG = {
    SERVICE_ID: 'service_zsl41hr', 
    TEMPLATE_ID: 'template_n6lgptu', 
    PUBLIC_KEY: '3u4OUXE7MSVKsOBZF' 
};

export const EmailService = {
    /**
     * Envia instruções de recuperação de senha via EmailJS.
     * @param type 'MANAGED' para usuários criados pelo Gestor (sem link) ou 'REAL' para usuários Auth (com link)
     */
    sendRecoveryInstructions: async (email: string, name?: string, type: 'MANAGED' | 'REAL' = 'REAL') => {
        
        const header = `
========================================
    MENSAGEM DO SISTEMA PROVA FÁCIL
========================================
        `;

        let body = '';

        if (type === 'MANAGED') {
            body = `
Olá, ${name || 'Professor(a)'}.

Sua conta é do tipo GERENCIADA PELA ESCOLA.
Isso significa que você NÃO possui redefinição automática por link.

O QUE FAZER:
1. Entre em contato com o Gestor da sua escola.
2. Solicite que ele defina uma nova senha manualmente no painel (Menu Usuários > Editar).

Não é possível alterar sua senha por este e-mail.
            `;
        } else {
            body = `
Olá, ${name || 'Usuário'}.

Tentamos enviar um LINK AUTOMÁTICO DE REDEFINIÇÃO do Firebase para: ${email}.

⚠️ ATENÇÃO - LEIA COM CUIDADO:

1. Se seu e-mail é GMAIL: O link deve chegar em instantes.
2. Se seu e-mail é YAHOO, OUTLOOK, HOTMAIL ou UOL:
   Esses provedores costumam bloquear e-mails automáticos.
   
   SE O LINK NÃO CHEGAR EM 2 MINUTOS:
   Não se preocupe! Peça ao Gestor da sua escola ou Administrador do sistema.
   Eles podem definir uma "Senha Manual" para você no Painel de Usuários imediatamente.

Verifique também sua caixa de SPAM ou LIXEIRA.
            `;
        }

        const fullMessage = `${header}\n${body}`;

        try {
            const isConfigured = 
                EMAILJS_CONFIG.PUBLIC_KEY !== 'YOUR_PUBLIC_KEY' && 
                EMAILJS_CONFIG.SERVICE_ID !== 'YOUR_SERVICE_ID' &&
                !EMAILJS_CONFIG.PUBLIC_KEY.includes('YOUR_');

            if (!isConfigured) {
                console.log(`[EmailJS Simulado] Enviando recuperação para: ${email}`);
                return { 
                    status: 200, 
                    text: 'OK', 
                    simulated: true, 
                    emailContent: fullMessage 
                };
            }

            const templateParams = {
                to_email: email,      
                email: email,
                user_email: email,
                recipient: email,
                reply_to: email,
                to_name: name || 'Usuário',
                subject: 'Instruções de Acesso - Prova Fácil', 
                message: fullMessage
            };

            const response = await emailjs.send(
                EMAILJS_CONFIG.SERVICE_ID,
                EMAILJS_CONFIG.TEMPLATE_ID,
                templateParams,
                EMAILJS_CONFIG.PUBLIC_KEY
            );

            return response;
        } catch (error: any) {
            let errorText = 'Erro desconhecido';
            if (error?.text) errorText = error.text; 
            else if (error?.message) errorText = error.message; 
            else if (typeof error === 'object') try { errorText = JSON.stringify(error); } catch { errorText = String(error); }
            else errorText = String(error);

            console.error(`Erro ao enviar email via EmailJS:`, errorText);
            throw error;
        }
    }
};
