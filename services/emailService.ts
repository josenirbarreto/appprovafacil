
import emailjs from '@emailjs/browser';

// CONFIGURAÇÃO DO EMAILJS
// Você deve criar uma conta em https://www.emailjs.com/
// 1. Crie um "Email Service" (ex: Gmail).
// 2. Crie um "Email Template".
//    - No template, use variáveis como {{to_name}}, {{to_email}}, {{message}}.
// 3. Pegue as chaves abaixo em "Account > API Keys" e "Email Services".

const EMAILJS_CONFIG = {
    SERVICE_ID: 'service_zsl41hr',
    TEMPLATE_ID: 'template_n6lgptu',
    PUBLIC_KEY: '3u4OUXE7MSVKsOBZF'
};

export const EmailService = {
    /**
     * Envia instruções de recuperação de senha via EmailJS.
     * Como não temos backend para gerar token seguro do Firebase, 
     * enviamos instruções genéricas ou um link de contato.
     */
    sendRecoveryInstructions: async (email: string, name?: string) => {
        try {
            // Verifica se as chaves estão configuradas (mock check)
            if (EMAILJS_CONFIG.PUBLIC_KEY === 'user_public_key') {
                console.warn("EmailJS não configurado. Simulando envio...");
                return new Promise((resolve) => setTimeout(resolve, 1000));
            }

            const templateParams = {
                to_email: email,
                to_name: name || 'Usuário',
                subject: 'Recuperação de Senha - Prova Fácil',
                message: `
                    Olá,

                    Recebemos uma solicitação para redefinir a senha da sua conta no Prova Fácil.

                    Como sua conta é gerenciada pela instituição, por favor entre em contato com o Administrador ou Gestor da sua escola para que eles redefinam sua senha manualmente no painel administrativo.

                    Se você é um Administrador e perdeu acesso, contate o suporte técnico.

                    Atenciosamente,
                    Equipe Prova Fácil
                `
            };

            const response = await emailjs.send(
                EMAILJS_CONFIG.SERVICE_ID,
                EMAILJS_CONFIG.TEMPLATE_ID,
                templateParams,
                EMAILJS_CONFIG.PUBLIC_KEY
            );

            return response;
        } catch (error) {
            console.error("Erro ao enviar email via EmailJS:", error);
            throw error;
        }
    }
};
