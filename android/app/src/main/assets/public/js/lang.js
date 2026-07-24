// Goldenstore i18n — Arabic (source) + English / French / Spanish.
// UI strings are translated instantly from a curated dictionary; everything
// else (descriptions, dynamic content) is auto-translated via /api/translate
// and cached permanently, so there is no flicker or language mixing.
(function () {
  'use strict';

  var LANGS = [
    { code: 'ar', label: 'العربية', dir: 'rtl' },
    { code: 'en', label: 'English', dir: 'ltr' },
    { code: 'fr', label: 'Français', dir: 'ltr' },
    { code: 'es', label: 'Español', dir: 'ltr' },
  ];

  function readLang() {
    try { var l = localStorage.getItem('gs_lang'); } catch (e) { l = null; }
    return LANGS.some(function (x) { return x.code === l; }) ? l : 'ar';
  }
  var lang = readLang();
  var dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;

  // ---- Curated overrides: exact Arabic text -> per-language translation. ----
  // Used for short UI terms where machine translation is ambiguous/risky.
  var O = {
    // bottom nav / chrome
    'التطبيقات': { en: 'Apps', fr: 'Applications', es: 'Aplicaciones' },
    'الألعاب': { en: 'Games', fr: 'Jeux', es: 'Juegos' },
    'بحث': { en: 'Search', fr: 'Recherche', es: 'Buscar' },
    'المميزة': { en: 'Featured', fr: 'En vedette', es: 'Destacados' },
    'أنت': { en: 'You', fr: 'Vous', es: 'Tú' },
    'الفئات': { en: 'Categories', fr: 'Catégories', es: 'Categorías' },
    'التصنيفات': { en: 'Categories', fr: 'Catégories', es: 'Categorías' },
    'تصفح': { en: 'Browse', fr: 'Parcourir', es: 'Explorar' },
    'تصفّح': { en: 'Browse', fr: 'Parcourir', es: 'Explorar' },
    'تصفح حسب الفئة': { en: 'Browse by category', fr: 'Parcourir par catégorie', es: 'Explorar por categoría' },
    'الإعدادات': { en: 'Settings', fr: 'Paramètres', es: 'Ajustes' },
    'مكتبتي': { en: 'My Library', fr: 'Ma bibliothèque', es: 'Mi biblioteca' },
    'مكتبتك فارغة': { en: 'Your library is empty', fr: 'Votre bibliothèque est vide', es: 'Tu biblioteca está vacía' },
    'تصفّح التطبيقات': { en: 'Browse apps', fr: 'Parcourir les apps', es: 'Explorar apps' },
    'إعادة تحميل': { en: 'Reinstall', fr: 'Réinstaller', es: 'Reinstalar' },
    'مسح السجل': { en: 'Clear history', fr: 'Effacer l\'historique', es: 'Borrar historial' },
    'المظهر': { en: 'Appearance', fr: 'Apparence', es: 'Apariencia' },
    'فاتح': { en: 'Light', fr: 'Clair', es: 'Claro' },
    'غامق': { en: 'Dark', fr: 'Sombre', es: 'Oscuro' },
    'اللغة': { en: 'Language', fr: 'Langue', es: 'Idioma' },
    'حول Golden Store': { en: 'About Golden Store', fr: 'À propos de Golden Store', es: 'Acerca de Golden Store' },
    'تسجيل الخروج': { en: 'Sign out', fr: 'Se déconnecter', es: 'Cerrar sesión' },
    'رجوع': { en: 'Back', fr: 'Retour', es: 'Atrás' },
    'إغلاق': { en: 'Close', fr: 'Fermer', es: 'Cerrar' },
    'مسح': { en: 'Clear', fr: 'Effacer', es: 'Borrar' },
    'حذف': { en: 'Delete', fr: 'Supprimer', es: 'Eliminar' },
    'إلغاء': { en: 'Cancel', fr: 'Annuler', es: 'Cancelar' },
    'إرسال': { en: 'Send', fr: 'Envoyer', es: 'Enviar' },
    'جديد': { en: 'New', fr: 'Nouveau', es: 'Nuevo' },
    'الإشعارات': { en: 'Notifications', fr: 'Notifications', es: 'Notificaciones' },
    'لا توجد إشعارات بعد': { en: 'No notifications yet', fr: 'Aucune notification pour l’instant', es: 'Todavía no hay notificaciones' },
    'تطبيق جديد': { en: 'New app', fr: 'Nouvelle app', es: 'Nueva app' },
    'تحديث': { en: 'Update', fr: 'Mise à jour', es: 'Actualización' },
    'إعلان': { en: 'Announcement', fr: 'Annonce', es: 'Anuncio' },

    // actions (machine translation gets these wrong, e.g. تثبيت -> "stabilisation")
    'تثبيت': { en: 'Install', fr: 'Installer', es: 'Instalar' },
    'تم التثبيت': { en: 'Installed', fr: 'Installé', es: 'Instalado' },
    'مثبت': { en: 'Installed', fr: 'Installé', es: 'Instalado' },
    'مثبّت': { en: 'Installed', fr: 'Installé', es: 'Instalado' },
    'فتح': { en: 'Open', fr: 'Ouvrir', es: 'Abrir' },
    'عرض': { en: 'View', fr: 'Voir', es: 'Ver' },
    'تنزيل': { en: 'Download', fr: 'Télécharger', es: 'Descargar' },
    'جارٍ التحميل…': { en: 'Downloading…', fr: 'Téléchargement…', es: 'Descargando…' },
    'سيتم التثبيت تلقائياً عند اكتمال التحميل.': { en: 'Installation will start automatically once download completes.', fr: 'L’installation démarrera automatiquement à la fin du téléchargement.', es: 'La instalación comenzará automáticamente al completar la descarga.' },
    'طلب تحديث': { en: 'Request update', fr: 'Demander une mise à jour', es: 'Solicitar actualización' },
    'إرسال الطلب': { en: 'Send request', fr: 'Envoyer la demande', es: 'Enviar solicitud' },
    'إبلاغ': { en: 'Report', fr: 'Signaler', es: 'Reportar' },
    'إبلاغ عن مشكلة': { en: 'Report a problem', fr: 'Signaler un problème', es: 'Reportar un problema' },
    'إبلاغ عن التطبيق': { en: 'Report app', fr: 'Signaler l’application', es: 'Reportar la aplicación' },
    'إرسال البلاغ': { en: 'Send report', fr: 'Envoyer le signalement', es: 'Enviar reporte' },

    'ابحث عن تطبيقات وألعاب': { en: 'Search apps and games', fr: 'Rechercher des applis et jeux', es: 'Buscar apps y juegos' },
    'عرض كل النتائج': { en: 'Show all results', fr: 'Voir tous les résultats', es: 'Ver todos los resultados' },
    'شبكة': { en: 'Grid', fr: 'Grille', es: 'Cuadrícula' },
    'قائمة': { en: 'List', fr: 'Liste', es: 'Lista' },

    // home sections / tabs
    'محتوى يهمك': { en: 'For you', fr: 'Pour vous', es: 'Para ti' },
    'الأكثر رواجا': { en: 'Trending', fr: 'Tendances', es: 'Tendencias' },
    'الأعلى تقييما': { en: 'Top rated', fr: 'Les mieux notés', es: 'Mejor valorados' },
    'موصى به لك': { en: 'Recommended for you', fr: 'Recommandé pour vous', es: 'Recomendado para ti' },
    'قد يعجبك أيضا': { en: 'You may also like', fr: 'Vous aimerez aussi', es: 'También te puede gustar' },
    'تطبيقات أخرى': { en: 'Other apps', fr: 'Autres applications', es: 'Otras aplicaciones' },
    'تطبيقات مماثلة': { en: 'Similar apps', fr: 'Applications similaires', es: 'Apps similares' },
    'ألعاب مماثلة': { en: 'Similar games', fr: 'Jeux similaires', es: 'Juegos similares' },
    'اختيارات المحررين': { en: 'Editors’ choice', fr: 'Choix de la rédaction', es: 'Selección del editor' },
    'ألعاب موصى بها': { en: 'Recommended games', fr: 'Jeux recommandés', es: 'Juegos recomendados' },
    'نتائج البحث': { en: 'Search results', fr: 'Résultats de recherche', es: 'Resultados de búsqueda' },

    // app detail labels
    'نبذة': { en: 'Overview', fr: 'Aperçu', es: 'Resumen' },
    'الوصف': { en: 'Description', fr: 'Description', es: 'Descripción' },
    'لقطات الشاشة': { en: 'Screenshots', fr: 'Captures d’écran', es: 'Capturas de pantalla' },
    'معلومات تقنية': { en: 'Technical info', fr: 'Informations techniques', es: 'Información técnica' },
    'المطور': { en: 'Developer', fr: 'Développeur', es: 'Desarrollador' },
    'المطوّر': { en: 'Developer', fr: 'Développeur', es: 'Desarrollador' },
    'التصنيف': { en: 'Category', fr: 'Catégorie', es: 'Categoría' },
    'الإصدار': { en: 'Version', fr: 'Version', es: 'Versión' },
    'الإصدار الحالي': { en: 'Current version', fr: 'Version actuelle', es: 'Versión actual' },
    'الإصدار الجديد': { en: 'New version', fr: 'Nouvelle version', es: 'Nueva versión' },
    'رابط المصدر': { en: 'Source link', fr: 'Lien source', es: 'Enlace de origen' },
    'سبب البلاغ': { en: 'Reason', fr: 'Motif', es: 'Motivo' },
    'تفاصيل إضافية': { en: 'Additional details', fr: 'Détails supplémentaires', es: 'Detalles adicionales' },
    'الحجم': { en: 'Size', fr: 'Taille', es: 'Tamaño' },
    'آخر تحديث': { en: 'Last updated', fr: 'Dernière mise à jour', es: 'Última actualización' },
    'عدد التنزيلات': { en: 'Downloads', fr: 'Téléchargements', es: 'Descargas' },
    'اسم الحزمة': { en: 'Package name', fr: 'Nom du package', es: 'Nombre del paquete' },

    // account / misc
    'تطبيقاتي وألعابي': { en: 'My apps & games', fr: 'Mes applis et jeux', es: 'Mis apps y juegos' },
    'إدارة التنزيلات': { en: 'Manage downloads', fr: 'Gérer les téléchargements', es: 'Gestionar descargas' },
    'الوضع الفاتح': { en: 'Light mode', fr: 'Mode clair', es: 'Modo claro' },
    'الوضع الغامق': { en: 'Dark mode', fr: 'Mode sombre', es: 'Modo oscuro' },
    'اللغة': { en: 'Language', fr: 'Langue', es: 'Idioma' },

    // category names
    // App categories
    'ألعاب': { en: 'Games', fr: 'Jeux', es: 'Juegos' },
    'تواصل اجتماعي': { en: 'Social', fr: 'Social', es: 'Social' },
    'اتصالات': { en: 'Communication', fr: 'Communication', es: 'Comunicación' },
    'أدوات': { en: 'Tools', fr: 'Outils', es: 'Herramientas' },
    'إنتاجية': { en: 'Productivity', fr: 'Productivité', es: 'Productividad' },
    'ترفيه': { en: 'Entertainment', fr: 'Divertissement', es: 'Entretenimiento' },
    'تعليم': { en: 'Education', fr: 'Éducation', es: 'Educación' },
    'تصوير': { en: 'Photography', fr: 'Photographie', es: 'Fotografía' },
    'موسيقى وصوتيات': { en: 'Music & Audio', fr: 'Musique et audio', es: 'Música y audio' },
    'مشغّلات فيديو': { en: 'Video Players', fr: 'Lecteurs vidéo', es: 'Reproductores de video' },
    'مالية': { en: 'Finance', fr: 'Finance', es: 'Finanzas' },
    'تسوق': { en: 'Shopping', fr: 'Achats', es: 'Compras' },
    'أخبار ومجلات': { en: 'News & Magazines', fr: 'Actualités et magazines', es: 'Noticias y revistas' },
    'صحة ولياقة': { en: 'Health & Fitness', fr: 'Santé et remise en forme', es: 'Salud y bienestar' },
    'سفر ومحلّي': { en: 'Travel & Local', fr: 'Voyage et local', es: 'Viajes y local' },
    'طعام وشراب': { en: 'Food & Drink', fr: 'Nourriture et boisson', es: 'Comida y bebida' },
    'أسلوب حياة': { en: 'Lifestyle', fr: 'Style de vie', es: 'Estilo de vida' },
    'كتب ومراجع': { en: 'Books & Reference', fr: 'Livres et références', es: 'Libros y referencia' },
    'أعمال': { en: 'Business', fr: 'Affaires', es: 'Negocios' },
    'تعارف': { en: 'Dating', fr: 'Rencontres', es: 'Citas' },
    'خرائط وملاحة': { en: 'Maps & Navigation', fr: 'Cartes et navigation', es: 'Mapas y navegación' },
    'طبّي': { en: 'Medical', fr: 'Médical', es: 'Médico' },
    'تخصيص': { en: 'Personalization', fr: 'Personnalisation', es: 'Personalización' },
    'رياضة': { en: 'Sports', fr: 'Sports', es: 'Deportes' },
    'طقس': { en: 'Weather', fr: 'Météo', es: 'Clima' },
    'سيارات ومركبات': { en: 'Auto & Vehicles', fr: 'Auto et véhicules', es: 'Autos y vehículos' },
    'جمال وتجميل': { en: 'Beauty', fr: 'Beauté', es: 'Belleza' },
    'فنّ وتصميم': { en: 'Art & Design', fr: 'Art et design', es: 'Arte y diseño' },
    'منزل': { en: 'House & Home', fr: 'Maison', es: 'Casa y hogar' },
    'أبوّة وأمومة': { en: 'Parenting', fr: 'Parentalité', es: 'Paternidad' },
    'فعاليات': { en: 'Events', fr: 'Événements', es: 'Eventos' },
    'قصص مصوّرة': { en: 'Comics', fr: 'Bandes dessinées', es: 'Cómics' },
    'أخرى': { en: 'Other', fr: 'Autres', es: 'Otros' },
    // Game categories
    'أكشن': { en: 'Action', fr: 'Action', es: 'Acción' },
    'مغامرات': { en: 'Adventure', fr: 'Aventure', es: 'Aventura' },
    'أركيد': { en: 'Arcade', fr: 'Arcade', es: 'Arcade' },
    'ألعاب لوحية': { en: 'Board', fr: 'Plateau', es: 'Mesa' },
    'ورق (كوتشينة)': { en: 'Card', fr: 'Cartes', es: 'Cartas' },
    'كازينو': { en: 'Casino', fr: 'Casino', es: 'Casino' },
    'عادية': { en: 'Casual', fr: 'Casual', es: 'Casual' },
    'تعليمية': { en: 'Educational', fr: 'Éducatif', es: 'Educativo' },
    'ألغاز': { en: 'Puzzle', fr: 'Puzzle', es: 'Rompecabezas' },
    'سباقات': { en: 'Racing', fr: 'Course', es: 'Carreras' },
    'تقمّص أدوار': { en: 'Role Playing', fr: 'Jeu de rôle', es: 'Rol' },
    'محاكاة': { en: 'Simulation', fr: 'Simulation', es: 'Simulación' },
    'رياضية': { en: 'Sports', fr: 'Sports', es: 'Deportes' },
    'استراتيجية': { en: 'Strategy', fr: 'Stratégie', es: 'Estrategia' },
    'معلومات عامة': { en: 'Trivia', fr: 'Quiz', es: 'Trivia' },
    'كلمات': { en: 'Word', fr: 'Mots', es: 'Palabras' },
    'ألعاب أخرى': { en: 'Other Games', fr: 'Autres jeux', es: 'Otros juegos' },
    'VPN وخصوصية': { en: 'VPN & Privacy', fr: 'VPN et confidentialité', es: 'VPN y privacidad' },
    'أدوات النظام': { en: 'System Tools', fr: 'Outils système', es: 'Herramientas del sistema' },
    'خلفيات': { en: 'Wallpapers', fr: 'Fonds d’écran', es: 'Fondos de pantalla' },
    'إدارة الملفات': { en: 'File Management', fr: 'Gestionnaire de fichiers', es: 'Gestión de archivos' },
    'اتصال وشبكات': { en: 'Connectivity', fr: 'Connectivité', es: 'Conectividad' },
    'عائلية': { en: 'Family', fr: 'Famille', es: 'Familiar' },
    'إطلاق نار': { en: 'Shooter', fr: 'Tir', es: 'Disparos' },
    'حركة ومغامرة': { en: 'Action & Adventure', fr: 'Action et aventure', es: 'Acción y aventura' },
    'ألعاب جماعية': { en: 'Role Playing', fr: 'Jeu de rôle', es: 'Juego de rol' },
    'موسيقى': { en: 'Music', fr: 'Musique', es: 'Música' },

    // empty / status
    'لا توجد نتائج': { en: 'No results', fr: 'Aucun résultat', es: 'Sin resultados' },
    'لا توجد تطبيقات بعد': { en: 'No apps yet', fr: 'Aucune application pour l’instant', es: 'Aún no hay aplicaciones' },
    'لا توجد ألعاب بعد': { en: 'No games yet', fr: 'Aucun jeu pour l’instant', es: 'Aún no hay juegos' },
    'لا توجد ألعاب مقيّمة بعد': { en: 'No rated games yet', fr: 'Aucun jeu noté pour l’instant', es: 'Aún no hay juegos valorados' },
    'لا توجد تطبيقات مقيّمة بعد': { en: 'No rated apps yet', fr: 'Aucune app notée pour l’instant', es: 'Aún no hay apps valoradas' },
    'لا توجد تطبيقات مميّزة بعد': { en: 'No featured apps yet', fr: 'Aucune app en vedette pour l’instant', es: 'Aún no hay apps destacadas' },
    'لا توجد مراجعات بعد. كن أول من يكتب مراجعة!': { en: 'No reviews yet. Be the first to write one!', fr: 'Aucun avis. Soyez le premier !', es: '¡Aún no hay reseñas. Sé el primero!' },
    'لا توجد تطبيقات في هذه الفئة بعد.': { en: 'No apps in this category yet.', fr: 'Aucune app dans cette catégorie.', es: 'Aún no hay apps en esta categoría.' },
    'ستظهر هنا اختيارات المحرّرين فور إضافتها من لوحة الإدارة.': { en: 'Editors’ picks will appear here once added from admin.', fr: 'Les choix de la rédaction apparaîtront ici.', es: 'Las selecciones del editor aparecerán aquí.' },
    'ستظهر هنا التطبيقات التي قمت بتحميلها لتسهيل إعادة تحميلها في أي وقت.': { en: 'Apps you’ve downloaded will appear here for easy reinstall.', fr: 'Les apps téléchargées apparaîtront ici.', es: 'Las apps descargadas aparecerán aquí.' },
    'ميّز تطبيقاً كـ«لعبة» من لوحة التحكم لتظهر هنا.': { en: 'Mark an app as "game" from admin to show here.', fr: 'Marquez une app comme « jeu » depuis l’admin.', es: 'Marca una app como "juego" desde el admin.' },
    'قيّم الألعاب لتظهر هنا الأعلى تقييماً.': { en: 'Rate games to see top-rated ones here.', fr: 'Notez des jeux pour voir les mieux notés ici.', es: 'Valora juegos para ver los mejor valorados aquí.' },
    'قيّم التطبيقات لتظهر هنا الأعلى تقييماً.': { en: 'Rate apps to see top-rated ones here.', fr: 'Notez des apps pour voir les mieux notées ici.', es: 'Valora apps para ver las mejor valoradas aquí.' },
    'لم نجد تطبيقات تطابق': { en: 'No apps matching', fr: 'Aucune app correspondant à', es: 'No encontramos apps que coincidan con' },

    // ratings & reviews
    'تقييم': { en: 'ratings', fr: 'évaluations', es: 'valoraciones' },
    'تقييمات': { en: 'ratings', fr: 'évaluations', es: 'valoraciones' },
    'تقييمك': { en: 'Your rating', fr: 'Votre note', es: 'Tu valoración' },
    'نجوم': { en: 'stars', fr: 'étoiles', es: 'estrellas' },
    'من': { en: 'of', fr: 'sur', es: 'de' },
    'كن أول من يقيّم هذا التطبيق': { en: 'Be the first to rate this app', fr: 'Soyez le premier à noter cette app', es: 'Sé el primero en valorar esta app' },
    'قيّم واكتب مراجعتك': { en: 'Rate and write your review', fr: 'Notez et écrivez votre avis', es: 'Valora y escribe tu reseña' },
    'تنشر باسم حسابك': { en: 'Published as your account', fr: 'Publié sous votre compte', es: 'Publicado con tu cuenta' },
    'شارك رأيك في هذا التطبيق…': { en: 'Share your thoughts about this app…', fr: 'Partagez votre avis sur cette app…', es: 'Comparte tu opinión sobre esta app…' },
    'نشر المراجعة': { en: 'Post review', fr: 'Publier l’avis', es: 'Publicar reseña' },
    'تم نشر مراجعتك': { en: 'Your review has been posted', fr: 'Votre avis a été publié', es: 'Tu reseña ha sido publicada' },
    'لقد قيّمت هذا التطبيق مسبقاً': { en: 'You’ve already rated this app', fr: 'Vous avez déjà noté cette app', es: 'Ya valoraste esta app' },
    'لقد قيّمت هذا التطبيق': { en: 'You’ve rated this app', fr: 'Vous avez noté cette app', es: 'Ya valoraste esta app' },
    'اختر عدد النجوم أولاً': { en: 'Select a star rating first', fr: 'Sélectionnez d’abord un nombre d’étoiles', es: 'Selecciona estrellas primero' },
    'شكراً لمراجعتك!': { en: 'Thanks for your review!', fr: 'Merci pour votre avis !', es: '¡Gracias por tu reseña!' },
    'تعذّر إرسال المراجعة': { en: 'Failed to submit review', fr: 'Échec de l’envoi de l’avis', es: 'Error al enviar la reseña' },
    'التقييمات والمراجعات': { en: 'Ratings & Reviews', fr: 'Notes et avis', es: 'Valoraciones y reseñas' },
    'مستخدم': { en: 'User', fr: 'Utilisateur', es: 'Usuario' },

    // app detail & install
    'تعذّر الاتصال بالخادم': { en: 'Could not connect to server', fr: 'Impossible de se connecter au serveur', es: 'No se pudo conectar al servidor' },
    'التطبيق غير موجود': { en: 'App not found', fr: 'Application introuvable', es: 'Aplicación no encontrada' },
    'لا يوجد تطبيق محدد': { en: 'No app specified', fr: 'Aucune app spécifiée', es: 'No se especificó una app' },
    'تأكد من الرابط أو عد للرئيسية.': { en: 'Check the URL or go back to home.', fr: 'Vérifiez le lien ou retournez à l’accueil.', es: 'Verifica el enlace o vuelve al inicio.' },
    'العودة للرئيسية': { en: 'Go to home', fr: 'Retour à l’accueil', es: 'Ir al inicio' },
    'لمحة عن هذا التطبيق': { en: 'About this app', fr: 'À propos de cette app', es: 'Sobre esta app' },
    'تنزيلات': { en: 'Downloads', fr: 'Téléchargements', es: 'Descargas' },
    'أندرويد': { en: 'Android', fr: 'Android', es: 'Android' },
    'شريحة': { en: 'Chip', fr: 'Puce', es: 'Chip' },
    'تطبيق': { en: 'app', fr: 'application', es: 'aplicación' },
    'يحتوي على عمليات شراء داخل التطبيق': { en: 'Contains in-app purchases', fr: 'Contient des achats intégrés', es: 'Contiene compras dentro de la app' },
    'جار التحميل…': { en: 'Downloading…', fr: 'Téléchargement…', es: 'Descargando…' },
    'اكتمل التحميل وحفظ الملف في جهازك': { en: 'Download complete, file saved', fr: 'Téléchargement terminé, fichier enregistré', es: 'Descarga completa, archivo guardado' },
    'سيتم تنزيل ملف APK': { en: 'APK file will be downloaded', fr: 'Le fichier APK sera téléchargé', es: 'Se descargará el archivo APK' },
    'فعل «تثبيت من مصادر غير معروفة» لإكمال التثبيت.': { en: 'Enable "Install from unknown sources" to complete.', fr: 'Activez « Sources inconnues » pour terminer.', es: 'Habilita "Fuentes desconocidas" para completar.' },
    'تعذر عرض شريط التقدم، وبدأ التنزيل بالطريقة العادية': { en: 'Progress bar unavailable, download started normally', fr: 'Barre de progression indisponible, téléchargement lancé', es: 'Barra de progreso no disponible, descarga iniciada' },
    'مشاركة': { en: 'Share', fr: 'Partager', es: 'Compartir' },
    'تم نسخ الرابط': { en: 'Link copied', fr: 'Lien copié', es: 'Enlace copiado' },
    'خيارات إضافية': { en: 'More options', fr: 'Plus d’options', es: 'Más opciones' },
    'تطبيق مميز مختار لك': { en: 'Featured app picked for you', fr: 'App en vedette choisie pour vous', es: 'App destacada elegida para ti' },

    // report / update request
    'التطبيق فيه فيروس': { en: 'App contains a virus', fr: 'L’application contient un virus', es: 'La app contiene un virus' },
    'رابط التحميل لا يعمل': { en: 'Download link not working', fr: 'Le lien ne fonctionne pas', es: 'El enlace de descarga no funciona' },
    'محتوى غير لائق': { en: 'Inappropriate content', fr: 'Contenu inapproprié', es: 'Contenido inapropiado' },
    'انتهاك حقوق نشر': { en: 'Copyright violation', fr: 'Violation de droits d’auteur', es: 'Violación de derechos de autor' },
    'معلومات خاطئة': { en: 'False information', fr: 'Informations erronées', es: 'Información falsa' },
    'سبب آخر': { en: 'Other reason', fr: 'Autre raison', es: 'Otro motivo' },
    'يرجى ملء الحقول المطلوبة': { en: 'Please fill required fields', fr: 'Veuillez remplir les champs requis', es: 'Completa los campos requeridos' },
    'تم إرسال طلبك إلى الإدارة': { en: 'Your request has been sent', fr: 'Votre demande a été envoyée', es: 'Tu solicitud ha sido enviada' },
    'تعذر الإرسال، حاول مجددا': { en: 'Failed to send, try again', fr: 'Échec, réessayez', es: 'Error al enviar, inténtalo de nuevo' },

    // auth / login
    'متابعة': { en: 'Continue', fr: 'Continuer', es: 'Continuar' },
    'متابعة باستخدام Google': { en: 'Continue with Google', fr: 'Continuer avec Google', es: 'Continuar con Google' },
    'متابعة بدون حساب': { en: 'Continue without account', fr: 'Continuer sans compte', es: 'Continuar sin cuenta' },
    'اضغط متابعة للدخول إلى المتجر وتنزيل التطبيقات — لا يحتاج حساب Google.': { en: 'Press continue to enter the store and download apps — no Google account required.', fr: 'Appuyez sur continuer pour accéder au store — aucun compte Google requis.', es: 'Presiona continuar para entrar a la tienda — no se necesita cuenta de Google.' },
    'سجل الدخول بحساب Google للوصول إلى المتجر وتنزيل التطبيقات.': { en: 'Sign in with Google to access the store.', fr: 'Connectez-vous avec Google pour accéder au store.', es: 'Inicia sesión con Google para acceder a la tienda.' },
    'بالمتابعة فإنك توافق على شروط الاستخدام وسياسة الخصوصية لـ Golden Store.': { en: 'By continuing, you agree to Golden Store terms and privacy policy.', fr: 'En continuant, vous acceptez les conditions de Golden Store.', es: 'Al continuar, aceptas los términos de Golden Store.' },
    'جار تسجيل الدخول…': { en: 'Signing in…', fr: 'Connexion…', es: 'Iniciando sesión…' },
    'حسابك': { en: 'Your account', fr: 'Votre compte', es: 'Tu cuenta' },

    // account / library
    'تطبيق في مكتبتك': { en: 'app in your library', fr: 'app dans votre bibliothèque', es: 'app en tu biblioteca' },
    'حذف سجل التحميلات بالكامل؟': { en: 'Clear entire download history?', fr: 'Effacer tout l’historique ?', es: '¿Borrar todo el historial de descargas?' },
    'تم مسح السجل': { en: 'History cleared', fr: 'Historique effacé', es: 'Historial borrado' },

    // misc
    'ابحث عن التطبيقات والألعاب': { en: 'Search apps & games', fr: 'Rechercher des apps et jeux', es: 'Buscar apps y juegos' },
    'اختيارات المحرّرين المنتقاة لك': { en: 'Editors’ picks curated for you', fr: 'Sélection de la rédaction pour vous', es: 'Selección del editor para ti' },
    'تعذر تحميل البيانات': { en: 'Failed to load data', fr: 'Échec du chargement', es: 'Error al cargar los datos' },
    'تحقق من اتصالك بالإنترنت ثم حدث الصفحة.': { en: 'Check your internet connection and refresh.', fr: 'Vérifiez votre connexion et actualisez.', es: 'Verifica tu conexión y actualiza.' },
    'حاول لاحقا بعد دقائق قليلة.': { en: 'Try again in a few minutes.', fr: 'Réessayez dans quelques minutes.', es: 'Inténtalo en unos minutos.' },
    'حدث الصفحة وحاول مجددا.': { en: 'Refresh the page and try again.', fr: 'Actualisez et réessayez.', es: 'Actualiza la página e inténtalo.' },
    'الخدمة غير متاحة مؤقتا': { en: 'Service temporarily unavailable', fr: 'Service temporairement indisponible', es: 'Servicio temporalmente no disponible' },
    'الرابط غير صحيح.': { en: 'Invalid link.', fr: 'Lien invalide.', es: 'Enlace no válido.' },
    'تصفّح حسب الفئة': { en: 'Browse by category', fr: 'Parcourir par catégorie', es: 'Explorar por categoría' },
    'المميّزة': { en: 'Featured', fr: 'En vedette', es: 'Destacados' },

    // admin UI labels
    'لوحة التحكم': { en: 'Admin panel', fr: 'Panneau d’admin', es: 'Panel de admin' },
    'لوحة المعلومات': { en: 'Dashboard', fr: 'Tableau de bord', es: 'Panel' },
    'التطبيقات': { en: 'Apps', fr: 'Applications', es: 'Aplicaciones' },
    'الألعاب': { en: 'Games', fr: 'Jeux', es: 'Juegos' },
    'إضافة جديد': { en: 'Add new', fr: 'Ajouter', es: 'Añadir' },
    'الطلبات والبلاغات': { en: 'Requests & reports', fr: 'Demandes et signalements', es: 'Solicitudes y reportes' },
    'الإشعارات': { en: 'Notifications', fr: 'Notifications', es: 'Notificaciones' },
    'تحديث التطبيق': { en: 'App update', fr: 'Mise à jour de l’app', es: 'Actualización de la app' },
    'الاسم': { en: 'Name', fr: 'Nom', es: 'Nombre' },
    'التصنيف': { en: 'Category', fr: 'Catégorie', es: 'Categoría' },
    'الإصدار': { en: 'Version', fr: 'Version', es: 'Versión' },
    'الحجم': { en: 'Size', fr: 'Taille', es: 'Tamaño' },
    'التنزيلات': { en: 'Downloads', fr: 'Téléchargements', es: 'Descargas' },
    'الإجراءات': { en: 'Actions', fr: 'Actions', es: 'Acciones' },
    'عرض': { en: 'View', fr: 'Voir', es: 'Ver' },
    'تعديل': { en: 'Edit', fr: 'Modifier', es: 'Editar' },
    'حذف': { en: 'Delete', fr: 'Supprimer', es: 'Eliminar' },
    'دخول مباشر': { en: 'Sign in', fr: 'Connexion', es: 'Iniciar sesión' },
    'كلمة مرور الإدارة': { en: 'Admin password', fr: 'Mot de passe admin', es: 'Contraseña de admin' },
    'كلمة المرور': { en: 'Password', fr: 'Mot de passe', es: 'Contraseña' },
    'كلمة المرور غير صحيحة': { en: 'Incorrect password', fr: 'Mot de passe incorrect', es: 'Contraseña incorrecta' },
    'إجمالي التطبيقات': { en: 'Total apps', fr: 'Total apps', es: 'Total apps' },
    'إجمالي التنزيلات': { en: 'Total downloads', fr: 'Total téléchargements', es: 'Total descargas' },
    'حجم التخزين': { en: 'Storage size', fr: 'Espace stockage', es: 'Tamaño de almacenamiento' },
    'الأكثر تنزيلاً': { en: 'Most downloaded', fr: 'Les plus téléchargés', es: 'Más descargados' },
    'صيانة': { en: 'Maintenance', fr: 'Maintenance', es: 'Mantenimiento' },
    'تعيين النوع للعناصر القديمة': { en: 'Set type for old items', fr: 'Définir le type des anciens éléments', es: 'Establecer tipo para elementos antiguos' },
    'لا توجد بيانات بعد': { en: 'No data yet', fr: 'Aucune donnée', es: 'Aún no hay datos' },
    'ارفع تطبيقك الأول لرؤية الإحصائيات.': { en: 'Upload your first app to see stats.', fr: 'Uploadez votre première app.', es: 'Sube tu primera app para ver estadísticas.' },
    'لا توجد طلبات أو بلاغات': { en: 'No requests or reports', fr: 'Aucune demande ni signalement', es: 'No hay solicitudes ni reportes' },
    'ستظهر هنا طلبات التحديث والبلاغات الواردة من المستخدمين.': { en: 'Update requests and reports will appear here.', fr: 'Les demandes de mise à jour et signalements apparaîtront ici.', es: 'Las solicitudes de actualización y reportes aparecerán aquí.' },
    'عنوان الإشعار': { en: 'Notification title', fr: 'Titre de notification', es: 'Título de notificación' },
    'النص': { en: 'Body', fr: 'Texte', es: 'Texto' },
    'نشر إشعار': { en: 'Publish notification', fr: 'Publier notification', es: 'Publicar notificación' },
    'إشعار تجريبي': { en: 'Test notification', fr: 'Notification test', es: 'Notificación de prueba' },
    'تم إرسال إشعار تجريبي': { en: 'Test notification sent', fr: 'Notification test envoyée', es: 'Notificación de prueba enviada' },
    'تم نشر الإشعار': { en: 'Notification published', fr: 'Notification publiée', es: 'Notificación publicada' },
    'لا توجد إشعارات بعد': { en: 'No notifications yet', fr: 'Aucune notification', es: 'Aún no hay notificaciones' },
    'ستظهر هنا الإشعارات المنشورة والتنبيهات الآلية.': { en: 'Published notifications and alerts will appear here.', fr: 'Les notifications publiées apparaîtront ici.', es: 'Las notificaciones publicadas aparecerán aquí.' },
    'أدخل عنوان الإشعار': { en: 'Enter notification title', fr: 'Entrez le titre', es: 'Ingrese el título' },
    'تم الحذف': { en: 'Deleted', fr: 'Supprimé', es: 'Eliminado' },
    'تعذر الحذف': { en: 'Delete failed', fr: 'Échec de suppression', es: 'Error al eliminar' },
    'تعذر النشر': { en: 'Publish failed', fr: 'Échec de publication', es: 'Error al publicar' },
    'إضافة تطبيق': { en: 'Add app', fr: 'Ajouter app', es: 'Añadir app' },
    'إضافة لعبة': { en: 'Add game', fr: 'Ajouter jeu', es: 'Añadir juego' },
    'إضافة تطبيق جديد': { en: 'Add new app', fr: 'Nouvelle app', es: 'Nueva app' },
    'إضافة لعبة جديدة': { en: 'Add new game', fr: 'Nouveau jeu', es: 'Nuevo juego' },
    'اسم الحزمة': { en: 'Package name', fr: 'Nom du package', es: 'Nombre del paquete' },
    'المطوّر': { en: 'Developer', fr: 'Développeur', es: 'Desarrollador' },
    'وصف مختصر': { en: 'Short description', fr: 'Description courte', es: 'Descripción corta' },
    'الوصف الكامل': { en: 'Full description', fr: 'Description complète', es: 'Descripción completa' },
    'اسم الإصدار': { en: 'Version name', fr: 'Nom de version', es: 'Nombre de versión' },
    'رمز الإصدار': { en: 'Version code', fr: 'Code de version', es: 'Código de versión' },
    'الحد الأدنى لـ Android SDK': { en: 'Minimum Android SDK', fr: 'SDK Android minimum', es: 'SDK Android mínimo' },
    'ملف APK': { en: 'APK file', fr: 'Fichier APK', es: 'Archivo APK' },
    'الأيقونة': { en: 'Icon', fr: 'Icône', es: 'Icono' },
    'الصورة العرضية': { en: 'Feature graphic', fr: 'Image de mise en avant', es: 'Imagen destacada' },
    'لقطات الشاشة': { en: 'Screenshots', fr: 'Captures d’écran', es: 'Capturas de pantalla' },
    'رفع التطبيق': { en: 'Upload app', fr: 'Uploader app', es: 'Subir app' },
    'إلغاء': { en: 'Cancel', fr: 'Annuler', es: 'Cancelar' },
    'البيانات الأساسية': { en: 'Basic info', fr: 'Informations de base', es: 'Información básica' },
    'تحديث ملف APK': { en: 'Update APK file', fr: 'Mettre à jour APK', es: 'Actualizar archivo APK' },
    'حفظ التغييرات': { en: 'Save changes', fr: 'Enregistrer', es: 'Guardar cambios' },
    'استبدال الأيقونة': { en: 'Replace icon', fr: 'Remplacer icône', es: 'Reemplazar icono' },
    'حفظ الصورة العرضية': { en: 'Save feature graphic', fr: 'Enregistrer image', es: 'Guardar imagen destacada' },
    'إضافة لقطات': { en: 'Add screenshots', fr: 'Ajouter captures', es: 'Añadir capturas' },
    'تم رفع التطبيق بنجاح': { en: 'App uploaded successfully', fr: 'App uploadée', es: 'App subida' },
    'فشل الرفع': { en: 'Upload failed', fr: 'Échec upload', es: 'Error al subir' },
    'فشل الحذف': { en: 'Delete failed', fr: 'Échec suppression', es: 'Error al eliminar' },
    'حذف «': { en: 'Delete «', fr: 'Supprimer «', es: 'Eliminar «' },
    '» نهائياً؟': { en: '» permanently?', fr: '» définitivement ?', es: '» permanentemente?' },
    'تم الحفظ': { en: 'Saved', fr: 'Enregistré', es: 'Guardado' },
    'فشل الحفظ': { en: 'Save failed', fr: 'Échec enregistrement', es: 'Error al guardar' },
    'تم تحديث APK': { en: 'APK updated', fr: 'APK mis à jour', es: 'APK actualizado' },
    'فشل التحديث': { en: 'Update failed', fr: 'Mise à jour échouée', es: 'Actualización fallida' },
    'تم التحديث بنجاح': { en: 'Update completed', fr: 'Mise à jour terminée', es: 'Actualización completada' },
    'تعارض توقيع الحزمة: ألغِ التطبيق المثبت ثم ثبّت النسخة الجديدة.': { en: 'Signature conflict: uninstall the existing app, then install the new version.', fr: 'Conflit de signature : désinstallez l’application existante, puis installez la nouvelle version.', es: 'Conflicto de firma: desinstale la aplicación existente, luego instale la nueva versión.' },
    'اسم الحزمة غير متطابق مع التطبيق.': { en: 'Package name does not match the app.', fr: 'Le nom du package ne correspond pas à l’application.', es: 'El nombre del paquete no coincide con la aplicación.' },
    'تعذّر قراءة ملف APK.': { en: 'Could not read APK file.', fr: 'Impossible de lire le fichier APK.', es: 'No se pudo leer el archivo APK.' },
    'فشل التثبيت.': { en: 'Installation failed.', fr: 'Échec de l’installation.', es: 'Error de instalación.' },
    'ملف التحميل مفقود.': { en: 'Downloaded file is missing.', fr: 'Le fichier téléchargé est introuvable.', es: 'Falta el archivo descargado.' },
    'تعذّر تحديث التطبيق. حاول إلغاء التثبيت وإعادة المحاولة.': { en: 'Could not update the app. Try uninstalling and retrying.', fr: 'Impossible de mettre à jour l’application. Essayez de la désinstaller et réessayez.', es: 'No se pudo actualizar la aplicación. Intente desinstalar y volver a intentar.' },
    'اختر ملف APK': { en: 'Select APK file', fr: 'Choisir APK', es: 'Seleccionar APK' },
    'اختر صورة': { en: 'Select image', fr: 'Choisir image', es: 'Seleccionar imagen' },
    'اختر صور': { en: 'Select images', fr: 'Choisir images', es: 'Seleccionar imágenes' },
    'حذف هذه اللقطة؟': { en: 'Delete this screenshot?', fr: 'Supprimer cette capture ?', es: '¿Eliminar captura?' },
    'فشلت الإضافة': { en: 'Add failed', fr: 'Échec ajout', es: 'Error al añadir' },

    // app update feature
    'تحديث جديد متاح': { en: 'New update available', fr: 'Nouvelle mise à jour', es: 'Nueva actualización disponible' },
    'يتوفر إصدار جديد من التطبيق. حمّله الآن للحصول على أحدث الميزات والإصلاحات.': { en: 'A new app version is available. Download now for the latest features and fixes.', fr: 'Une nouvelle version est disponible. Téléchargez maintenant.', es: 'Hay una nueva versión disponible. Descárgala ahora.' },
    'تحميل الآن': { en: 'Download now', fr: 'Télécharger', es: 'Descargar ahora' },
    'لاحقاً': { en: 'Later', fr: 'Plus tard', es: 'Más tarde' },
    'إصدار التطبيق': { en: 'App version', fr: 'Version de l’app', es: 'Versión de la app' },
    'رابط APK': { en: 'APK URL', fr: 'URL APK', es: 'URL APK' },
    'ملاحظات التحديث': { en: 'Update notes', fr: 'Notes de mise à jour', es: 'Notas de actualización' },
    'إرسال التحديث': { en: 'Send update', fr: 'Envoyer mise à jour', es: 'Enviar actualización' },
    'حفظ رابط التحميل': { en: 'Save download link', fr: 'Enregistrer le lien', es: 'Guardar enlace' },
    'رابط تحميل التطبيق': { en: 'App download link', fr: 'Lien de téléchargement', es: 'Enlace de descarga' },
    'تم حفظ الرابط': { en: 'Link saved', fr: 'Lien enregistré', es: 'Enlace guardado' },
    'فشل حفظ الرابط': { en: 'Failed to save link', fr: 'Échec enregistrement', es: 'Error al guardar enlace' },
    'إرسال إشعار للمستخدمين': { en: 'Send notification to users', fr: 'Envoyer notification', es: 'Enviar notificación' },
    'هذا الرابط سيظهر في زر تحميل صفحة التحميل. إذا أدخلت إصدارا جديدا، سيظهر للمستخدمين نافذة تحديث داخل التطبيق.': { en: 'This link will appear on the download button. If you enter a new version, users will see an update dialog inside the app.', fr: 'Ce lien apparaîtra sur le bouton de téléchargement. Si vous entrez une nouvelle version, les utilisateurs verront une fenêtre de mise à jour.', es: 'Este enlace aparecerá en el botón de descarga. Si ingresas una nueva versión, los usuarios verán un diálogo de actualización.' },
    'الرابط غير متوفر بعد': { en: 'Link not available yet', fr: 'Lien non disponible', es: 'Enlace no disponible' },
    'نشر التحديث': { en: 'Publish update', fr: 'Publier la mise à jour', es: 'Publicar actualización' },
    'رفع تحديث التطبيق': { en: 'Upload app update', fr: 'Uploader la mise à jour', es: 'Subir actualización' },
    'تم نشر التحديث': { en: 'Update published', fr: 'Mise à jour publiée', es: 'Actualización publicada' },
    'فشل نشر التحديث': { en: 'Failed to publish update', fr: 'Échec publication', es: 'Error al publicar' },
    'اختر ملف APK أولاً': { en: 'Select an APK file first', fr: 'Choisissez d’abord un APK', es: 'Seleccione primero un APK' },
    'جارٍ رفع APK…': { en: 'Uploading APK…', fr: 'Upload APK…', es: 'Subiendo APK…' },
    'إجبار التحديث (لا يمكن التجاوز)': { en: 'Force update (cannot skip)', fr: 'Forcer la mise à jour', es: 'Forzar actualización' },
    'الإشعار': { en: 'Notification', fr: 'Notification', es: 'Notificación' },
    'ما الجديد في هذا التحديث؟': { en: 'What is new in this update?', fr: 'Quoi de neuf ?', es: '¿Qué hay de nuevo?' },
    'قم بتحميل تطبيق Golden Store واحصل على آلاف التطبيقات والألعاب في مكان واحد.': { en: 'Download Golden Store and get thousands of apps and games in one place.', fr: 'Téléchargez Golden Store et obtenez des milliers d’apps et jeux.', es: 'Descarga Golden Store y obtén miles de apps y juegos en un solo lugar.' },
    'الإصدار الحالي': { en: 'Current version', fr: 'Version actuelle', es: 'Versión actual' },
    'إصدار': { en: 'Version', fr: 'Version', es: 'Versión' },
    'Golden Store هو متجرك العربي لتحميل أحدث التطبيقات والألعاب المهكرة (Mod) والمدفوعة مجاناً بأحدث إصداراتها، مع ميزات مفتوحة بالكامل وبدون إعلانات. نختار المحتوى بعناية ونحدّثه باستمرار، ونوفّر تحميلاً مباشراً سريعاً وآمناً.': { en: 'Golden Store is your Arab store for downloading the latest cracked (Mod) and paid apps and games for free, with fully unlocked features and no ads. We carefully curate content and update it constantly, providing fast and direct downloads.', fr: 'Golden Store est votre store arabe pour télécharger les dernières applications et jeux crackés (Mod) et payés gratuitement, avec des fonctionnalités entièrement déverrouillées et sans publicités. Nous sélectionnons soigneusement le contenu et le mettons à jour constamment, offrant des téléchargements rapides et directs.', es: 'Golden Store es tu tienda árabe para descargar las últimas aplicaciones y juegos crackeados (Mod) y pagados gratis, con funciones completamente desbloqueadas y sin anuncios. Seleccionamos cuidadosamente el contenido y lo actualizamos constantemente, ofreciendo descargas rápidas y directas.' },
    'أدخل بيانات الحساب الصحيحة': { en: 'Enter the correct account information', fr: 'Saisissez les bonnes coordonnées du compte', es: 'Introduce la información de la cuenta correcta' },
    'أدخل رمز صديقك': { en: 'Enter your friend code', fr: 'Entrez le code de votre ami', es: 'Introduce el código de tu amigo' },
    'إجمالي المسحوب': { en: 'Total withdrawn', fr: 'Total retiré', es: 'Total retirado' },
    'إجمالي النقاط المكتسبة': { en: 'Total points earned', fr: 'Total de points gagnés', es: 'Total de puntos ganados' },
    'إشعار': { en: 'Notification', fr: 'Notification', es: 'Notificación' },
    'إعادة المحاولة': { en: 'Retry', fr: 'Réessayer', es: 'Reintentar' },
    'اختيارات المحرّرين': { en: 'Editor picks', fr: 'Sélection de la rédaction', es: 'Selección del editor' },
    'ادعُ صديقاً واربح نقاطاً': { en: 'Invite a friend and earn points', fr: 'Invitez un ami et gagnez des points', es: 'Invita a un amigo y gana puntos' },
    'افتح الرابط في المتصفح الخارجي لتسجيل الدخول': { en: 'Open the link in an external browser to sign in', fr: 'Ouvrez le lien dans un navigateur externe pour vous connecter', es: 'Abre el enlace en un navegador externo para iniciar sesión' },
    'اكتمل التحميل': { en: 'Download completed', fr: 'Téléchargement terminé', es: 'Descarga completada' },
    'اكسب نقاطاً مع كل تثبيت واسحب أرباحك': { en: 'Earn points with every install and withdraw your earnings', fr: 'Gagnez des points à chaque installation et retirez vos gains', es: 'Gana puntos con cada instalación y retira tus ganancias' },
    'الأعلى تقييماً': { en: 'Highest rated', fr: 'Les mieux notés', es: 'Mejor valorados' },
    'الأكثر رواجًا': { en: 'Most popular', fr: 'Les plus populaires', es: 'Más populares' },
    'الحد الأدنى للسحب': { en: 'Minimum withdrawal', fr: 'Retrait minimum', es: 'Retiro mínimo' },
    'الحد الأدنى للسحب هو': { en: 'The minimum withdrawal is', fr: 'Le retrait minimum est', es: 'El retiro mínimo es' },
    'الخدمة غير متاحة مؤقتاً': { en: 'Service temporarily unavailable', fr: 'Service temporairement indisponible', es: 'Servicio temporalmente no disponible' },
    'المبلغ أكبر من رصيدك': { en: 'Amount exceeds your balance', fr: 'Le montant dépasse votre solde', es: 'El monto supera tu saldo' },
    'المبلغ بالدولار': { en: 'Amount in dollars', fr: 'Montant en dollars', es: 'Monto en dólares' },
    'بدء رفع الملفات…': { en: 'Start uploading files…', fr: 'Début du téléversement…', es: 'Comenzar a subir archivos…' },
    'بدأ التنزيل…': { en: 'Download started…', fr: 'Téléchargement commencé…', es: 'Descarga iniciada…' },
    'بيانات الحساب': { en: 'Account information', fr: 'Informations du compte', es: 'Información de la cuenta' },
    'تأكد من الرابط أو عُد للرئيسية.': { en: 'Check the link or return to the home page.', fr: 'Vérifiez le lien ou retournez à l’accueil.', es: 'Verifica el enlace o vuelve a la página principal.' },
    'تحتاج إلى': { en: 'You need', fr: 'Vous avez besoin de', es: 'Necesitas' },
    'تحقّق من اتصالك بالإنترنت ثمّ حدّث الصفحة.': { en: 'Check your internet connection then refresh the page.', fr: 'Vérifiez votre connexion Internet puis actualisez la page.', es: 'Verifica tu conexión a Internet y luego actualiza la página.' },
    'تسجيل الدخول': { en: 'Log in', fr: 'Connexion', es: 'Iniciar sesión' },
    'تسجيل الدخول مطلوب': { en: 'Login required', fr: 'Connexion requise', es: 'Inicio de sesión requerido' },
    'تصفح التطبيقات': { en: 'Browse apps', fr: 'Parcourir les applications', es: 'Explorar aplicaciones' },
    'تعذر النسخ': { en: 'Copy failed', fr: 'Échec de la copie', es: 'Error al copiar' },
    'تعذر تفعيل الرمز': { en: 'Could not activate code', fr: 'Impossible d’activer le code', es: 'No se pudo activar el código' },
    'تعذّر إرسال الطلب، حاول مجدداً': { en: 'Could not send request, try again', fr: 'Impossible d’envoyer la demande, réessayez', es: 'No se pudo enviar la solicitud, inténtalo de nuevo' },
    'تعذّر الإرسال، حاول مجدداً': { en: 'Could not send, try again', fr: 'Envoi impossible, réessayez', es: 'No se pudo enviar, inténtalo de nuevo' },
    'تعذّر التنزيل، حاول مجدداً': { en: 'Download failed, try again', fr: 'Téléchargement échoué, réessayez', es: 'Descarga fallida, inténtalo de nuevo' },
    'تعذّر الحذف': { en: 'Delete failed', fr: 'Échec de suppression', es: 'Error al eliminar' },
    'تعذّر تحميل البيانات': { en: 'Could not load data', fr: 'Impossible de charger les données', es: 'No se pudieron cargar los datos' },
    'تعذّر تحميل النقاط، حاول مجدداً': { en: 'Could not load points, try again', fr: 'Impossible de charger les points, réessayez', es: 'No se pudieron cargar los puntos, inténtalo de nuevo' },
    'تعذّر تحميل بيانات الدعوة': { en: 'Could not load invitation data', fr: 'Impossible de charger les données d’invitation', es: 'No se pudieron cargar los datos de invitación' },
    'تعذّر تسجيل الدخول، حاول مجدداً': { en: 'Could not log in, try again', fr: 'Impossible de se connecter, réessayez', es: 'No se pudo iniciar sesión, inténtalo de nuevo' },
    'تفعيل': { en: 'Activate', fr: 'Activer', es: 'Activar' },
    'تم إرسال طلب السحب، ستتم مراجعته قريباً': { en: 'Withdrawal request sent, it will be reviewed soon', fr: 'Demande de retrait envoyée, elle sera examinée bientôt', es: 'Solicitud de retiro enviada, será revisada pronto' },
    'تم التنزيل، جارٍ التثبيت…': { en: 'Downloaded, installing…', fr: 'Téléchargé, installation…', es: 'Descargado, instalando…' },
    'تم تحديث الأيقونة': { en: 'Icon updated', fr: 'Icône mise à jour', es: 'Icono actualizado' },
    'تم تحديث الصورة العرضية': { en: 'Feature image updated', fr: 'Image de mise en avant mise à jour', es: 'Imagen destacada actualizada' },
    'تم نسخ الرمز': { en: 'Code copied', fr: 'Code copié', es: 'Código copiado' },
    'تمت': { en: 'Approved', fr: 'Approuvé', es: 'Aprobado' },
    'تمت الإضافة': { en: 'Added', fr: 'Ajouté', es: 'Añadido' },
    'تمت المشاركة': { en: 'Shared', fr: 'Partagé', es: 'Compartido' },
    'تواصل معنا': { en: 'Contact us', fr: 'Contactez-nous', es: 'Contáctanos' },
    'تُحتسب النقاط مرة واحدة فقط لكل تطبيق': { en: 'Points are counted only once per app', fr: 'Les points ne sont comptés qu’une seule fois par application', es: 'Los puntos se cuentan solo una vez por aplicación' },
    'جارٍ الإرسال…': { en: 'Sending…', fr: 'Envoi…', es: 'Enviando…' },
    'جارٍ التثبيت…': { en: 'Installing…', fr: 'Installation…', es: 'Instalando…' },
    'جارٍ التنزيل…': { en: 'Downloading…', fr: 'Téléchargement…', es: 'Descargando…' },
    'جميع التقييمات والمراجعات': { en: 'All ratings and reviews', fr: 'Toutes les notes et avis', es: 'Todas las valoraciones y reseñas' },
    'حاول لاحقاً بعد دقائق قليلة.': { en: 'Try again in a few minutes.', fr: 'Réessayez dans quelques minutes.', es: 'Inténtalo de nuevo en unos minutos.' },
    'حدّث الصفحة وحاول مجدداً.': { en: 'Refresh the page and try again.', fr: 'Actualisez la page et réessayez.', es: 'Actualiza la página e inténtalo de nuevo.' },
    'دعوت': { en: 'Invited', fr: 'Invité', es: 'Invitado' },
    'ربحت': { en: 'You earned', fr: 'Vous avez gagné', es: 'Ganaste' },
    'رصيد هاتف (Flexy)': { en: 'Phone credit (Flexy)', fr: 'Crédit téléphonique (Flexy)', es: 'Saldo telefónico (Flexy)' },
    'رصيدك غير كافٍ للسحب': { en: 'Insufficient balance for withdrawal', fr: 'Solde insuffisant pour le retrait', es: 'Saldo insuficiente para retirar' },
    'رقم الحساب / البريد / المحفظة': { en: 'Account number / email / wallet', fr: 'Numéro de compte / e-mail / portefeuille', es: 'Número de cuenta / correo / billetera' },
    'رمز غير صالح': { en: 'Invalid code', fr: 'Code invalide', es: 'Código no válido' },
    'ستظهر هنا تطبيقات المتجر فور إضافتها من لوحة الإدارة.': { en: 'Store apps will appear here once added from the admin panel.', fr: 'Les applications du store apparaîtront ici une fois ajoutées depuis le panneau d’admin.', es: 'Las aplicaciones de la tienda aparecerán aquí una vez añadidas desde el panel de admin.' },
    'سجّل الدخول بحساب Google لتتمكن من تنزيل التطبيقات والتقييم والمزيد.': { en: 'Sign in with your Google account to download apps, rate them and more.', fr: 'Connectez-vous avec votre compte Google pour télécharger des applications, les noter et plus.', es: 'Inicia sesión con tu cuenta de Google para descargar aplicaciones, valorarlas y más.' },
    'صديقاً': { en: 'friend', fr: 'ami', es: 'amigo' },
    'طريقة السحب': { en: 'Withdrawal method', fr: 'Méthode de retrait', es: 'Método de retiro' },
    'طلب السحب': { en: 'Withdrawal request', fr: 'Demande de retrait', es: 'Solicitud de retiro' },
    'طلب سحب الأرباح': { en: 'Profit withdrawal request', fr: 'Demande de retrait des gains', es: 'Solicitud de retiro de ganancias' },
    'طلبات السحب': { en: 'Withdrawal requests', fr: 'Demandes de retrait', es: 'Solicitudes de retiro' },
    'عرض أقل': { en: 'Show less', fr: 'Afficher moins', es: 'Mostrar menos' },
    'عرض المزيد': { en: 'Show more', fr: 'Afficher plus', es: 'Mostrar más' },
    'على الأقل لطلب السحب': { en: 'at least to request withdrawal', fr: 'au moins pour demander un retrait', es: 'al menos para solicitar retiro' },
    'عن Golden Store': { en: 'About Golden Store', fr: 'À propos de Golden Store', es: 'Acerca de Golden Store' },
    'فشل التحميل': { en: 'Download failed', fr: 'Téléchargement échoué', es: 'Descarga fallida' },
    'فشل تفعيل الإشعارات: ': { en: 'Failed to enable notifications: ', fr: 'Échec de l’activation des notifications : ', es: 'Error al activar notificaciones: ' },
    'فعّل «تثبيت من مصادر غير معروفة» لإكمال التثبيت.': { en: 'Enable "Install from unknown sources" to complete installation.', fr: 'Activez « Sources inconnues » pour terminer l’installation.', es: 'Habilita "Instalar desde fuentes desconocidas" para completar la instalación.' },
    'قيد المراجعة': { en: 'Under review', fr: 'En cours de révision', es: 'En revisión' },
    'قيمتها بالدولار': { en: 'Value in dollars', fr: 'Valeur en dollars', es: 'Valor en dólares' },
    'كل تثبيت لتطبيق جديد يمنحك': { en: 'Each install of a new app gives you', fr: 'Chaque installation d’une nouvelle application vous donne', es: 'Cada instalación de una nueva app te da' },
    'كيف تعمل النقاط؟': { en: 'How do points work?', fr: 'Comment fonctionnent les points ?', es: '¿Cómo funcionan los puntos?' },
    'لا يمكنك استخدام رمزك الخاص': { en: 'You cannot use your own code', fr: 'Vous ne pouvez pas utiliser votre propre code', es: 'No puedes usar tu propio código' },
    'لعبة': { en: 'game', fr: 'jeu', es: 'juego' },
    'لقد استخدمت رمز دعوة من قبل': { en: 'You have already used an invite code', fr: 'Vous avez déjà utilisé un code d’invitation', es: 'Ya has usado un código de invitación' },
    'لقد فعّلت رمز دعوة ✓': { en: 'You activated an invite code ✓', fr: 'Vous avez activé un code d’invitation ✓', es: 'Has activado un código de invitación ✓' },
    'متاح': { en: 'Available', fr: 'Disponible', es: 'Disponible' },
    'محاولات كثيرة، انتظر قليلاً': { en: 'Too many attempts, wait a moment', fr: 'Trop de tentatives, attendez un peu', es: 'Demasiados intentos, espera un momento' },
    'مرفوض': { en: 'Rejected', fr: 'Refusé', es: 'Rechazado' },
    'نسخ': { en: 'Copy', fr: 'Copier', es: 'Copiar' },
    'نقاط': { en: 'points', fr: 'points', es: 'puntos' },
    'نقاط التشغيل': { en: 'Operating points', fr: 'Points de fonctionnement', es: 'Puntos de operación' },
    'نقاط عند تفعيله لرمزك.': { en: 'points when they activate your code.', fr: 'points lorsqu’il active votre code.', es: 'puntos cuando active su código.' },
    'نقطة': { en: 'point', fr: 'point', es: 'punto' },
    'نقطة في حسابك': { en: 'point in your account', fr: 'point dans votre compte', es: 'punto en tu cuenta' },
    'نقطة لكل تثبيت': { en: 'point per install', fr: 'point par installation', es: 'punto por instalación' },
    'هل تريد بالتأكيد تسجيل الخروج من حسابك؟ ستحتاج لتسجيل الدخول مجدداً للوصول إلى المتجر.': { en: 'Are you sure you want to sign out? You will need to sign in again to access the store.', fr: 'Voulez-vous vraiment vous déconnecter ? Vous devrez vous reconnecter pour accéder au store.', es: '¿Seguro que quieres cerrar sesión? Deberás iniciar sesión de nuevo para acceder a la tienda.' },
    'وتحصل أنت على': { en: 'and you get', fr: 'et vous obtenez', es: 'y obtienes' },
    'يجب رفع ملف APK': { en: 'An APK file must be uploaded', fr: 'Un fichier APK doit être téléversé', es: 'Se debe subir un archivo APK' },
    'يحصل صديقك على': { en: 'Your friend gets', fr: 'Votre ami reçoit', es: 'Tu amigo recibe' },
    'يمكنك طلب السحب الآن': { en: 'You can request withdrawal now', fr: 'Vous pouvez demander un retrait maintenant', es: 'Puedes solicitar un retiro ahora' },
    'سجّل الدخول لعرض نقاطك': { en: 'Log in to view your points', fr: 'Connectez-vous pour voir vos points', es: 'Inicia sesión para ver tus puntos' },
    'نقاطك مرتبطة بحساب Google. سجّل الدخول لعرض رصيدك وطلب السحب.': { en: 'Your points are linked to a Google account. Log in to view your balance and request withdrawal.', fr: 'Vos points sont liés à un compte Google. Connectez-vous pour voir votre solde et demander un retrait.', es: 'Tus puntos están vinculados a una cuenta de Google. Inicia sesión para ver tu saldo y solicitar un retiro.' },
    'تم تحديث أنواع العناصر': { en: 'Item types updated', fr: 'Types d’éléments mis à jour', es: 'Tipos de elementos actualizados' },
    'فشل الرفع': { en: 'Upload failed', fr: 'Échec de l’upload', es: 'Error al subir' },
    'غير مقيّم': { en: 'Not rated', fr: 'Non évalué', es: 'Sin valorar' },
    'مقيّم': { en: 'Rated', fr: 'Évalué', es: 'Valorado' },
    'مثال: 2.5.1': { en: 'e.g. 2.5.1', fr: 'ex. 2.5.1', es: 'ej. 2.5.1' },
    'مثال: https://play.google.com/...': { en: 'e.g. https://play.google.com/...', fr: 'ex. https://play.google.com/...', es: 'ej. https://play.google.com/...' },
    'اشرح المشكلة…': { en: 'Describe the issue…', fr: 'Décrivez le problème…', es: 'Describe el problema…' },
    'خيارات إضافية': { en: 'More options', fr: 'Plus d’options', es: 'Más opciones' },
  };

  // Number/size unit labels per language.
  var UNITS = {
    bytes: { ar: ['ب', 'ك.ب', 'م.ب', 'ج.ب'], en: ['B', 'KB', 'MB', 'GB'], fr: ['o', 'Ko', 'Mo', 'Go'], es: ['B', 'KB', 'MB', 'GB'] },
    count: { ar: ['', 'ألف', 'مليون', 'مليار'], en: ['', 'K', 'M', 'B'], fr: ['', 'K', 'M', 'Md'], es: ['', 'K', 'M', 'MM'] },
  };
  function units(kind) { var u = UNITS[kind]; return (u && (u[lang] || u.ar)) || []; }

  var AR = /[\u0600-\u06FF]/;
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };

  // ---- translation cache (per-language, persisted) ----
  var cacheKey = 'gs_tr_' + lang;
  var cache = {};
  try { cache = JSON.parse(localStorage.getItem(cacheKey) || '{}') || {}; } catch (e) { cache = {}; }
  var cacheDirty = false;
  function saveCache() {
    if (!cacheDirty) return;
    try { localStorage.setItem(cacheKey, JSON.stringify(cache)); cacheDirty = false; } catch (e) {}
  }
  setInterval(saveCache, 2000);
  window.addEventListener('beforeunload', saveCache);

  // Normalized override lookup (ignore Arabic diacritics / tatweel) so that
  // "الأعلى تقييماً" and "الأعلى تقييما" both resolve to the same entry.
  function norm(s) { return s.replace(/[\u064B-\u0652\u0670\u0640]/g, ''); }
  var ON = {};
  var LOOKUP = {};
  Object.keys(O).forEach(function (k) {
    ON[norm(k)] = O[k];
    // Build a reverse lookup so dynamic values (like English category names)
    // can be mapped back to the Arabic source key and then translated.
    var vals = O[k];
    if (vals) {
      ['ar', 'en', 'fr', 'es'].forEach(function (l) {
        var v = vals[l] || (l === 'ar' ? k : '');
        if (!v) return;
        var key = v.toLowerCase().trim();
        if (key && !LOOKUP[key]) LOOKUP[key] = k;
      });
    }
  });
  function lookup(text) {
    return LOOKUP[(text || '').toString().toLowerCase().trim()] || null;
  }

  function known(core) {
    var ov = ON[norm(core)];
    if (ov && ov[lang]) return ov[lang];
    if (cache[core] != null) return cache[core];
    return null;
  }

  // pending: core text -> list of apply callbacks
  var pending = {};
  var pendingKeys = [];
  var scheduled = false;
  var applying = false;

  function queue(core, applyFn) {
    if (!pending[core]) { pending[core] = []; pendingKeys.push(core); }
    pending[core].push(applyFn);
    if (!scheduled) { scheduled = true; setTimeout(flush, 80); }
  }

  function flush() {
    scheduled = false;
    var keys = pendingKeys, map = pending;
    pendingKeys = []; pending = {};
    if (!keys.length) return;
    var todo = keys.filter(function (k) { return cache[k] == null; });
    var applyAll = function () {
      keys.forEach(function (core) {
        var v = known(core);
        if (v == null) return;
        map[core].forEach(function (fn) { applying = true; try { fn(v); } finally { applying = false; } });
      });
    };
    if (!todo.length) { applyAll(); return; }
    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: lang, q: todo }),
    }).then(function (r) { return r.json(); }).then(function (data) {
      var t = (data && data.t) || [];
      todo.forEach(function (core, i) {
        var v = t[i];
        // Cache any non-empty string (even if unchanged) so we never re-request
        // it and never blank out content. Empty results are ignored.
        if (typeof v === 'string' && v) { cache[core] = v; cacheDirty = true; }
      });
      applyAll();
      saveCache();
    }).catch(function () { applyAll(); });
  }

  // Replace the meaningful (trimmed) part of a string, preserving surrounding whitespace.
  function reflow(raw, translated) {
    var core = raw.trim();
    if (!core) return raw;
    var idx = raw.indexOf(core);
    return raw.slice(0, idx) + translated + raw.slice(idx + core.length);
  }

  function doTextNode(node) {
    var raw = node.nodeValue;
    if (!raw || !AR.test(raw)) return;
    var core = raw.trim();
    if (!core) return;
    var hit = known(core);
    if (hit != null) {
      var out = reflow(raw, hit);
      if (out !== node.nodeValue) { applying = true; node.nodeValue = out; applying = false; }
      return;
    }
    queue(core, function (v) {
      // re-read raw in case the node text changed meanwhile
      var cur = node.nodeValue;
      if (cur && AR.test(cur)) node.nodeValue = reflow(cur, v);
    });
  }

  function doAttr(elm, attr) {
    if (!elm.getAttribute) return;
    var raw = elm.getAttribute(attr);
    if (!raw || !AR.test(raw)) return;
    var core = raw.trim();
    if (!core) return;
    var hit = known(core);
    if (hit != null) { applying = true; elm.setAttribute(attr, reflow(raw, hit)); applying = false; return; }
    queue(core, function (v) { applying = true; elm.setAttribute(attr, reflow(raw, v)); applying = false; });
  }

  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

  function walk(root) {
    if (lang === 'ar' || !root) return;
    if (root.nodeType === 3) { doTextNode(root); return; }
    if (root.nodeType !== 1) return;
    if (root.closest && root.closest('[data-noi18n]')) return;

    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !AR.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        while (p && p.nodeType === 1) {
          if (SKIP_TAGS[p.tagName] || (p.hasAttribute && p.hasAttribute('data-noi18n'))) return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var nodes = [], cur;
    while ((cur = tw.nextNode())) nodes.push(cur);
    nodes.forEach(doTextNode);

    var elems = [root];
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) elems.push(all[i]);
    elems.forEach(function (e) {
      if (e.closest && e.closest('[data-noi18n]')) return;
      for (var a = 0; a < ATTRS.length; a++) if (e.hasAttribute && e.hasAttribute(ATTRS[a])) doAttr(e, ATTRS[a]);
    });
  }

  var observer = new MutationObserver(function (muts) {
    if (applying || lang === 'ar') return;
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === 'characterData') { doTextNode(m.target); }
      else if (m.addedNodes) {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) walk(n);
          else if (n.nodeType === 3) doTextNode(n);
        }
      }
    }
  });

  function start() {
    if (lang === 'ar') return;
    walk(document.body);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    if (document.title && AR.test(document.title)) {
      var ttl = document.title, core = ttl.trim();
      var hit = known(core);
      if (hit != null) document.title = reflow(ttl, hit);
      else queue(core, function (v) { document.title = reflow(ttl, v); });
    }
  }

  function setLang(l) {
    if (!LANGS.some(function (x) { return x.code === l; }) || l === lang) return;
    try { localStorage.setItem('gs_lang', l); } catch (e) {}
    location.reload();
  }

  // Language switcher button (globe + menu). Self-contained DOM.
  function switcherEl() {
    var wrap = document.createElement('div');
    wrap.className = 'lang-switch';
    wrap.setAttribute('data-noi18n', '');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn lang-btn';
    btn.setAttribute('aria-label', 'Language');
    try { btn.appendChild(window.GSIcons.iconEl('globe', 'icon')); } catch (e) {}
    var code = document.createElement('span');
    code.className = 'lang-code';
    code.textContent = lang.toUpperCase();
    btn.appendChild(code);

    var menu = document.createElement('div');
    menu.className = 'lang-menu';
    LANGS.forEach(function (l) {
      var it = document.createElement('button');
      it.type = 'button';
      it.className = 'lang-item' + (l.code === lang ? ' on' : '');
      it.textContent = l.label;
      it.onclick = function () { setLang(l.code); };
      menu.appendChild(it);
    });

    btn.onclick = function (e) { e.stopPropagation(); wrap.classList.toggle('open'); };
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) wrap.classList.remove('open'); });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    return wrap;
  }

  function t(arText) {
    if (lang === 'ar') return arText;
    var hit = known((arText || '').trim());
    return hit != null ? hit : arText;
  }

  window.GSI18N = {
    lang: lang,
    isRTL: dir === 'rtl',
    setLang: setLang,
    switcherEl: switcherEl,
    units: units,
    t: t,
    translate: walk,
    lookup: lookup,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
