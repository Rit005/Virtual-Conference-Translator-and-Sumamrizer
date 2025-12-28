import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation resources
const resources = {
  en: {
    translation: {
      // Auth
      login: 'Login',
      signup: 'Sign Up',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      name: 'Name',
      logout: 'Logout',
      loginSuccess: 'Login successful!',
      signupSuccess: 'Account created successfully!',
      loginError: 'Login failed. Please try again.',
      signupError: 'Signup failed. Please try again.',
      fillAllFields: 'Please fill in all fields',
      passwordsMismatch: 'Passwords do not match',
      
      // Navigation
      dashboard: 'Dashboard',
      conference: 'Conference',
      liveCaptions: 'Live Captions',
      chatQA: 'Chat / Q&A',
      summary: 'Summary',
      
      // Conference
      joinConference: 'Join Conference',
      startConference: 'Start Conference',
      sessionId: 'Session ID',
      participants: 'Participants',
      language: 'Language',
      selectLanguage: 'Select Language',
      connect: 'Connect',
      disconnect: 'Disconnect',
      connected: 'Connected',
      disconnected: 'Disconnected',
      
      // Chat
      typeMessage: 'Type a message...',
      send: 'Send',
      like: 'Like',
      liked: 'Liked',
      reply: 'Reply',
      
      // Summary
      generateSummary: 'Generate Summary',
      keyPoints: 'Key Discussion Points',
      actionItems: 'Action Items',
      meetingDuration: 'Meeting Duration',
      participantsCount: 'Number of Participants',
      
      // UI
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Info',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      close: 'Close',
      
      // Theme
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
      
      // Common
      welcome: 'Welcome',
      hello: 'Hello',
      yes: 'Yes',
      no: 'No',
      ok: 'OK',
    }
  },
  hi: {
    translation: {
      // Auth
      login: 'लॉगिन',
      signup: 'साइन अप',
      email: 'ईमेल',
      password: 'पासवर्ड',
      confirmPassword: 'पासवर्ड की पुष्टि करें',
      name: 'नाम',
      logout: 'लॉगआउट',
      loginSuccess: 'लॉगिन सफल!',
      signupSuccess: 'खाता सफलतापूर्वक बनाया गया!',
      loginError: 'लॉगिन विफल। कृपया पुनः प्रयास करें।',
      signupError: 'साइन अप विफल। कृपया पुनः प्रयास करें।',
      fillAllFields: 'कृपया सभी फ़ील्ड भरें',
      passwordsMismatch: 'पासवर्ड मेल नहीं खाते',
      
      // Navigation
      dashboard: 'डैशबोर्ड',
      conference: 'सम्मेलन',
      liveCaptions: 'लाइव कैप्शन',
      chatQA: 'चैट / प्रश्नोत्तर',
      summary: 'सारांश',
      
      // Conference
      joinConference: 'सम्मेलन में शामिल हों',
      startConference: 'सम्मेलन शुरू करें',
      sessionId: 'सत्र आईडी',
      participants: 'प्रतिभागी',
      language: 'भाषा',
      selectLanguage: 'भाषा चुनें',
      connect: 'कनेक्ट करें',
      disconnect: 'डिस्कनेक्ट करें',
      connected: 'कनेक्टेड',
      disconnected: 'डिस्कनेक्टेड',
      
      // Chat
      typeMessage: 'संदेश टाइप करें...',
      send: 'भेजें',
      like: 'पसंद',
      liked: 'पसंद किया',
      reply: 'जवाब',
      
      // Summary
      generateSummary: 'सारांश बनाएं',
      keyPoints: 'मुख्य चर्चा बिंदु',
      actionItems: 'कार्य आइटम',
      meetingDuration: 'बैठक की अवधि',
      participantsCount: 'प्रतिभागियों की संख्या',
      
      // UI
      loading: 'लोड हो रहा है...',
      error: 'त्रुटि',
      success: 'सफल',
      warning: 'चेतावनी',
      info: 'जानकारी',
      cancel: 'रद्द करें',
      save: 'सहेजें',
      delete: 'हटाएं',
      edit: 'संपादित करें',
      close: 'बंद करें',
      
      // Theme
      lightMode: 'लाइट मोड',
      darkMode: 'डार्क मोड',
      
      // Common
      welcome: 'स्वागत है',
      hello: 'नमस्ते',
      yes: 'हाँ',
      no: 'नहीं',
      ok: 'ठीक है',
    }
  },
  es: {
    translation: {
      // Auth
      login: 'Iniciar Sesión',
      signup: 'Registrarse',
      email: 'Correo Electrónico',
      password: 'Contraseña',
      confirmPassword: 'Confirmar Contraseña',
      name: 'Nombre',
      logout: 'Cerrar Sesión',
      loginSuccess: '¡Inicio de sesión exitoso!',
      signupSuccess: '¡Cuenta creada exitosamente!',
      loginError: 'Error al iniciar sesión. Inténtalo de nuevo.',
      signupError: 'Error al registrarse. Inténtalo de nuevo.',
      fillAllFields: 'Por favor completa todos los campos',
      passwordsMismatch: 'Las contraseñas no coinciden',
      
      // Navigation
      dashboard: 'Panel de Control',
      conference: 'Conferencia',
      liveCaptions: 'Subtítulos en Vivo',
      chatQA: 'Chat / Preguntas',
      summary: 'Resumen',
      
      // Conference
      joinConference: 'Unirse a la Conferencia',
      startConference: 'Iniciar Conferencia',
      sessionId: 'ID de Sesión',
      participants: 'Participantes',
      language: 'Idioma',
      selectLanguage: 'Seleccionar Idioma',
      connect: 'Conectar',
      disconnect: 'Desconectar',
      connected: 'Conectado',
      disconnected: 'Desconectado',
      
      // Chat
      typeMessage: 'Escribe un mensaje...',
      send: 'Enviar',
      like: 'Me gusta',
      liked: 'Te gusta',
      reply: 'Responder',
      
      // Summary
      generateSummary: 'Generar Resumen',
      keyPoints: 'Puntos Clave de Discusión',
      actionItems: 'Elementos de Acción',
      meetingDuration: 'Duración de la Reunión',
      participantsCount: 'Número de Participantes',
      
      // UI
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      warning: 'Advertencia',
      info: 'Información',
      cancel: 'Cancelar',
      save: 'Guardar',
      delete: 'Eliminar',
      edit: 'Editar',
      close: 'Cerrar',
      
      // Theme
      lightMode: 'Modo Claro',
      darkMode: 'Modo Oscuro',
      
      // Common
      welcome: 'Bienvenido',
      hello: 'Hola',
      yes: 'Sí',
      no: 'No',
      ok: 'Aceptar',
    }
  },
  fr: {
    translation: {
      // Auth
      login: 'Se Connecter',
      signup: "S'inscrire",
      email: 'E-mail',
      password: 'Mot de Passe',
      confirmPassword: 'Confirmer le Mot de Passe',
      name: 'Nom',
      logout: 'Se Déconnecter',
      loginSuccess: 'Connexion réussie!',
      signupSuccess: 'Compte créé avec succès!',
      loginError: 'Échec de la connexion. Veuillez réessayer.',
      signupError: "Échec de l'inscription. Veuillez réessayer.",
      fillAllFields: 'Veuillez remplir tous les champs',
      passwordsMismatch: 'Les mots de passe ne correspondent pas',
      
      // Navigation
      dashboard: 'Tableau de Bord',
      conference: 'Conférence',
      liveCaptions: 'Sous-titres en Direct',
      chatQA: 'Chat / Q&R',
      summary: 'Résumé',
      
      // Conference
      joinConference: 'Rejoindre la Conférence',
      startConference: 'Démarrer la Conférence',
      sessionId: 'ID de Session',
      participants: 'Participants',
      language: 'Langue',
      selectLanguage: 'Sélectionner la Langue',
      connect: 'Connecter',
      disconnect: 'Déconnecter',
      connected: 'Connecté',
      disconnected: 'Déconnecté',
      
      // Chat
      typeMessage: 'Tapez un message...',
      send: 'Envoyer',
      like: 'J\'aime',
      liked: 'Aimé',
      reply: 'Répondre',
      
      // Summary
      generateSummary: 'Générer un Résumé',
      keyPoints: 'Points Clés de Discussion',
      actionItems: 'Actions à Entreprendre',
      meetingDuration: 'Durée de la Réunion',
      participantsCount: 'Nombre de Participants',
      
      // UI
      loading: 'Chargement...',
      error: 'Erreur',
      success: 'Succès',
      warning: 'Avertissement',
      info: 'Information',
      cancel: 'Annuler',
      save: 'Sauvegarder',
      delete: 'Supprimer',
      edit: 'Modifier',
      close: 'Fermer',
      
      // Theme
      lightMode: 'Mode Clair',
      darkMode: 'Mode Sombre',
      
      // Common
      welcome: 'Bienvenue',
      hello: 'Bonjour',
      yes: 'Oui',
      no: 'Non',
      ok: 'D\'accord',
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already does escaping
    },
  });

export default i18n;
