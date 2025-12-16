
import emailjs from '@emailjs/browser';

// --- CONFIGURAÇÃO DO EMAILJS ---
const EMAILJS_CONFIG = {
    SERVICE_ID: 'service_zsl41hr', 
    TEMPLATE_ID: 'template_n6lgptu', 
    PUBLIC_KEY: '3u4OUXE7MSVKsOBZF' 
};

export const EmailService = {
    /**
     * Envia e-mail de boas-vindas com a senha inicial gerada.
     */
    sendWelcomeCredentials: async (email: string, name: string, tempPassword: string) => {
        const header = `
========================================
    BEM-VINDO AO PROVA FÁCIL
========================================
        `;

        const body = `
Olá, ${name}.

Sua conta de professor foi criada com sucesso pelo Gestor da sua escola.

Aqui estão suas credenciais de acesso temporárias:

E-mail: ${email}
Senha Provisória: ${tempPassword}

IMPORTANTE:
Ao fazer o primeiro login, você será obrigado a definir uma nova senha pessoal e segura.

Acesse agora: https://app-provafacil.firebaseapp.com/ (ou o link da sua aplicação)
        `;

        const fullMessage = `${header}\n${body}`;

        return EmailService.sendEmailInternal(email, name, 'Acesso Criado - Prova Fácil', fullMessage);
    },

    /**
     * Envia instruções de recuperação de senha via EmailJS.
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
2. Solicite que ele redefina sua conta (Excluir e criar novamente com nova senha).

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
   Peça ao Gestor da sua escola. Eles podem excluir e recriar seu usuário definindo uma senha manual.

Verifique também sua caixa de SPAM ou LIXEIRA.
            `;
        }

        const fullMessage = `${header}\n${body}`;
        return EmailService.sendEmailInternal(email, name || 'Usuário', 'Instruções de Acesso - Prova Fácil', fullMessage);
    },

    // Função interna auxiliar para evitar duplicação de código EmailJS
    sendEmailInternal: async (email: string, name: string, subject: string, message: string) => {
        try {
            const isConfigured = 
                EMAILJS_CONFIG.PUBLIC_KEY !== 'YOUR_PUBLIC_KEY' && 
                EMAILJS_CONFIG.SERVICE_ID !== 'YOUR_SERVICE_ID' &&
                !EMAILJS_CONFIG.PUBLIC_KEY.includes('YOUR_');

            if (!isConfigured) {
                console.log(`[EmailJS Simulado] Assunto: ${subject} | Para: ${email}`);
                return { 
                    status: 200, 
                    text: 'OK', 
                    simulated: true, 
                    emailContent: message 
                };
            }

            const templateParams = {
                to_email: email,      
                email: email,
                user_email: email,
                recipient: email,
                reply_to: email,
                to_name: name,
                subject: subject, 
                message: message
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
            else errorText = String(error);

            console.error(`Erro ao enviar email via EmailJS:`, errorText);
            throw error;
        }
    }
};
