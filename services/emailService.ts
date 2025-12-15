
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
2. Solicite que ele defina uma nova senha manualmente no painel.

Não é possível alterar sua senha por este e-mail.
            `;
        } else {
            body = `
Olá, ${name || 'Usuário'}.

Enviamos um LINK OFICIAL DE REDEFINIÇÃO para este e-mail (${email}).
O remetente oficial é "noreply@app-provafacil...".

IMPORTANTE:
- Verifique sua caixa de SPAM ou LIXEIRA.
- O e-mail do Google pode demorar alguns minutos.
- Clique no link daquele e-mail para criar sua nova senha.

Este é apenas um aviso de confirmação.
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
