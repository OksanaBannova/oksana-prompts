/* =========================================================
   ОКСАНА — ПРОМТЫ
   Основная логика приложения
   Хранение: IndexedDB
   Версия с массовой загрузкой фотографий
   + МАССОВОЕ УПРАВЛЕНИЕ РАБОТАМИ
========================================================= */

"use strict";


/* =========================================================
   НАСТРОЙКИ
========================================================= */

const DB_NAME = "oksana-prompts-db";
const DB_VERSION = 1;
const STORE_NAME = "works";

const DEFAULT_CATEGORIES = [
    "Осень",
    "Зима",
    "Весна",
    "Лето",
    "Парные",
    "Детские",
    "Женские",
    "Мужские",
    "Семейные",
    "Свадебные",
    "Праздничные",
    "Портрет",
    "Фотосессия",
    "Деловые"
];


/* =========================================================
   СОСТОЯНИЕ
========================================================= */

let db = null;

let works = [];

let currentFilteredWorks = [];

let activeCategory = "Все";

let searchQuery = "";

let showFavoritesOnly = false;

let currentViewWorkId = null;

let selectedCategories = [];

let currentImageData = null;

let currentImageMimeType = null;

let editingWorkId = null;

let currentViewMode = "grid";

let toastTimer = null;

/* =========================================================
   УМНЫЙ ФИЛЬТР
========================================================= */

let activeSmartFilter =
    "all";


/* =========================================================
   СОСТОЯНИЕ МАССОВОЙ ЗАГРУЗКИ
========================================================= */

let bulkFiles = [];

let bulkSelectedCategories = [];

let bulkCommonPrompt = "";

let bulkCommonTitlePrefix = "";


/* =========================================================
   СОСТОЯНИЕ МАССОВОГО УПРАВЛЕНИЯ
========================================================= */

let selectionMode = false;

let selectedWorkIds = new Set();

let massCategories = [];


/* =========================================================
   DOM
========================================================= */

const elements = {

    gallery:
        document.getElementById("gallery"),

    categories:
        document.getElementById("categories"),

    searchInput:
        document.getElementById("searchInput"),

    clearSearch:
        document.getElementById("clearSearch"),

    worksCount:
        document.getElementById("worksCount"),

    favoritesCount:
        document.getElementById("favoritesCount"),

    emptyState:
        document.getElementById("emptyState"),

    resetFiltersButton:
        document.getElementById("resetFiltersButton"),

    showAllButton:
        document.getElementById("showAllButton"),

    favoritesButton:
        document.getElementById("favoritesButton"),

    openAddButton:
        document.getElementById("openAddButton"),

    mobileHomeButton:
        document.getElementById("mobileHomeButton"),

    mobileFavoritesButton:
        document.getElementById("mobileFavoritesButton"),

    mobileAddButton:
        document.getElementById("mobileAddButton"),

    mobileSettingsButton:
        document.getElementById("mobileSettingsButton"),
        
desktopSettingsButton:
    document.getElementById("desktopSettingsButton"),

    logoButton:
        document.getElementById("logoButton"),

    gridViewButton:
        document.getElementById("gridViewButton"),

    compactViewButton:
        document.getElementById("compactViewButton"),


    /* VIEW */

    viewModal:
        document.getElementById("viewModal"),

    closeViewModal:
        document.getElementById("closeViewModal"),

    viewImage:
        document.getElementById("viewImage"),

    viewModalTitle:
        document.getElementById("viewModalTitle"),

    viewCategories:
        document.getElementById("viewCategories"),

    viewPrompt:
        document.getElementById("viewPrompt"),

    copyPromptButton:
        document.getElementById("copyPromptButton"),

    viewFavoriteButton:
        document.getElementById("viewFavoriteButton"),

    editFromViewButton:
        document.getElementById("editFromViewButton"),


    /* FORM */

    formModal:
        document.getElementById("formModal"),

    closeFormModal:
        document.getElementById("closeFormModal"),

    formModalTitle:
        document.getElementById("formModalTitle"),

    workForm:
        document.getElementById("workForm"),

    editWorkId:
        document.getElementById("editWorkId"),

    imageInput:
        document.getElementById("imageInput"),

    uploadArea:
        document.getElementById("uploadArea"),

    uploadPlaceholder:
        document.getElementById("uploadPlaceholder"),

    imagePreview:
        document.getElementById("imagePreview"),

    fileName:
        document.getElementById("fileName"),

    titleInput:
        document.getElementById("titleInput"),

    promptInput:
        document.getElementById("promptInput"),

    charactersCount:
        document.getElementById("charactersCount"),

    categoryInput:
        document.getElementById("categoryInput"),

    addCategoryButton:
        document.getElementById("addCategoryButton"),

    selectedTags:
        document.getElementById("selectedTags"),

    categorySuggestions:
        document.getElementById("categorySuggestions"),

    cancelFormButton:
        document.getElementById("cancelFormButton"),

    saveButtonText:
        document.getElementById("saveButtonText"),


    /* SETTINGS */

    settingsModal:
        document.getElementById("settingsModal"),

    closeSettingsModal:
        document.getElementById("closeSettingsModal"),

    exportButton:
        document.getElementById("exportButton"),

    importInput:
        document.getElementById("importInput"),

    clearDatabaseButton:
        document.getElementById("clearDatabaseButton"),


    /* TOAST */

    toast:
        document.getElementById("toast"),

    toastIcon:
        document.getElementById("toastIcon"),

    toastMessage:
        document.getElementById("toastMessage")
};


/* =========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
========================================================= */

function generateId() {

    return (
        Date.now().toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );
}


function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function normalizeText(value) {

    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/ё/g, "е");
}


function formatDate(timestamp) {

    if (!timestamp) {
        return "";
    }

    return new Intl.DateTimeFormat(
        "ru-RU",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(new Date(timestamp));
}


function getFileNameWithoutExtension(name) {

    return String(name || "НейроФото")
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "НейроФото";
}


function formatBytes(bytes) {

    if (!bytes) {
        return "0 Б";
    }

    const units = [
        "Б",
        "КБ",
        "МБ",
        "ГБ"
    ];

    const index =
        Math.min(
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            ),
            units.length - 1
        );

    const value =
        bytes /
        Math.pow(
            1024,
            index
        );

    return (
        value.toFixed(
            index === 0 ? 0 : 1
        ) +
        " " +
        units[index]
    );
}


/* =========================================================
   TOAST
========================================================= */

function showToast(message, icon = "✓") {

    if (!elements.toast) {
        return;
    }

    elements.toastIcon.textContent = icon;
    elements.toastMessage.textContent = message;

    elements.toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {

        elements.toast.classList.remove("show");

    }, 2600);
}


/* =========================================================
   INDEXED DB
========================================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );


        request.onupgradeneeded = event => {

            const database =
                event.target.result;

            if (
                !database.objectStoreNames
                    .contains(STORE_NAME)
            ) {

                const store =
                    database.createObjectStore(
                        STORE_NAME,
                        {
                            keyPath: "id"
                        }
                    );

                store.createIndex(
                    "createdAt",
                    "createdAt",
                    {
                        unique: false
                    }
                );

                store.createIndex(
                    "title",
                    "title",
                    {
                        unique: false
                    }
                );
            }
        };


        request.onsuccess = event => {

            db =
                event.target.result;

            db.onerror = () => {

                console.error(
                    "Ошибка IndexedDB:",
                    db.error
                );
            };

            resolve(db);
        };


        request.onerror = () => {

            reject(
                request.error ||
                new Error(
                    "Не удалось открыть базу данных"
                )
            );
        };

    });
}


function getAllWorks() {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readonly"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.getAll();

            request.onsuccess = () => {

                resolve(
                    request.result || []
                );
            };

            request.onerror = () => {

                reject(
                    request.error
                );
            };
        }
    );
}


function saveWorkToDB(work) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.put(work);

            request.onsuccess = () => {

                resolve(work);
            };

            request.onerror = () => {

                reject(
                    request.error
                );
            };
        }
    );
}


function deleteWorkFromDB(id) {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.delete(id);

            request.onsuccess = () => {

                resolve();
            };

            request.onerror = () => {

                reject(
                    request.error
                );
            };
        }
    );
}


/* =========================================================
   МАССОВОЕ УДАЛЕНИЕ ИЗ INDEXED DB
========================================================= */

function deleteWorksFromDB(ids) {

    return new Promise(
        (resolve, reject) => {

            if (!ids || !ids.length) {
                resolve();
                return;
            }

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );


            ids.forEach(id => {

                store.delete(id);

            });


            transaction.oncomplete = () => {

                resolve();

            };


            transaction.onerror = () => {

                reject(
                    transaction.error ||
                    new Error(
                        "Не удалось удалить работы"
                    )
                );

            };


            transaction.onabort = () => {

                reject(
                    transaction.error ||
                    new Error(
                        "Удаление было отменено"
                    )
                );

            };
        }
    );
}


function clearDatabase() {

    return new Promise(
        (resolve, reject) => {

            const transaction =
                db.transaction(
                    STORE_NAME,
                    "readwrite"
                );

            const store =
                transaction.objectStore(
                    STORE_NAME
                );

            const request =
                store.clear();

            request.onsuccess = () => {

                resolve();
            };

            request.onerror = () => {

                reject(
                    request.error
                );
            };
        }
    );
}


/* =========================================================
   ЗАГРУЗКА
========================================================= */

async function loadWorks() {

    try {

        works =
            await getAllWorks();

        works.sort(
            (a, b) =>
                (b.createdAt || 0) -
                (a.createdAt || 0)
        );

        renderAll();

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось загрузить библиотеку",
            "!"
        );
    }
}


/* =========================================================
   КАТЕГОРИИ
========================================================= */
function getAllCategories() {

    const categorySet =
        new Set(
            DEFAULT_CATEGORIES
        );


    getCustomCategories()
        .forEach(
            category => {

                const clean =
                    String(category)
                        .trim();

                if (clean) {
                    categorySet.add(
                        clean
                    );
                }
            }
        );


    works.forEach(
        work => {

            if (
                !Array.isArray(
                    work.categories
                )
            ) {
                return;
            }


            work.categories.forEach(
                category => {

                    const clean =
                        String(category)
                            .trim();

                    if (clean) {
                        categorySet.add(
                            clean
                        );
                    }
                }
            );
        }
    );


    const hidden =
        getHiddenCategories();


    return Array.from(
        categorySet
    )
        .filter(
            category =>
                !hidden.some(
                    hiddenCategory =>
                        normalizeText(
                            hiddenCategory
                        ) ===
                        normalizeText(
                            category
                        )
                )
        )
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "ru"
                )
        );
}


function renderCategories() {

    if (!elements.categories) {
        return;
    }

    const categories =
        getAllCategories();

    const allCategories = [
        "Все",
        ...categories
    ];

    elements.categories.innerHTML =
        allCategories
            .map(category => {

                const active =
                    activeCategory ===
                    category;

                return `
                    <button
                        type="button"
                        class="category-button ${active ? "active" : ""}"
                        data-category="${escapeHTML(category)}"
                    >
                        ${escapeHTML(category)}
                    </button>
                `;

            })
            .join("");


    elements.categories
        .querySelectorAll(
            ".category-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    activeCategory =
                        button.dataset.category;

                    showFavoritesOnly =
                        false;

                    updateMobileNavigation();

                    renderAll();
                }
            );
        });
}


/* =========================================================
   ФИЛЬТРАЦИЯ
========================================================= */
function getFilteredWorks() {

    let result =
        [...works];


    /* =====================================================
       ИЗБРАННОЕ
    ===================================================== */

    if (showFavoritesOnly) {

        result =
            result.filter(
                work =>
                    work.favorite === true
            );
    }


    /* =====================================================
   УМНЫЕ ФИЛЬТРЫ
===================================================== */

if (
    activeSmartFilter !==
    "all"
) {

    result =
        result.filter(
            work => {

                if (
                    activeSmartFilter ===
                    "pinned"
                ) {

                    return (
                        work.pinned ===
                        true
                    );
                }


                if (
                    activeSmartFilter ===
                    "favorites"
                ) {

                    return (
                        work.favorite ===
                        true
                    );
                }


                if (
                    activeSmartFilter ===
                    "without-prompt"
                ) {

                    return !(
                        work.prompt &&
                        String(
                            work.prompt
                        ).trim()
                    );
                }


                if (
                    activeSmartFilter ===
                    "without-category"
                ) {

                    return !(
                        Array.isArray(
                            work.categories
                        ) &&
                        work.categories
                            .some(
                                category =>
                                    String(
                                        category
                                    ).trim()
                            )
                    );
                }


                return true;
            }
        );
}

    /* =====================================================
       ФИЛЬТР ПО КАТЕГОРИИ
    ===================================================== */

    if (
        activeCategory &&
        activeCategory !== "Все"
    ) {

        const normalizedCategory =
            normalizeText(
                activeCategory
            );

        result =
            result.filter(
                work => {

                    const categories =
                        Array.isArray(
                            work.categories
                        )
                            ? work.categories
                            : [];

                    return categories.some(
                        category =>
                            normalizeText(
                                category
                            ) ===
                            normalizedCategory
                    );
                }
            );
    }


    /* =====================================================
       ПОИСК
    ===================================================== */

    if (searchQuery) {

        const query =
            normalizeText(
                searchQuery
            )
                .replace(
                    /[-–—_,.;:!?/\\]+/g,
                    " "
                );


        const searchWords =
            query
                .split(/\s+/)
                .filter(Boolean);


        result =
            result.filter(
                work => {

                    const categories =
                        Array.isArray(
                            work.categories
                        )
                            ? work.categories
                            : [];


                    const searchableText =
                        [
                            work.title,
                            work.prompt,
                            work.description,
                            work.fileName,
                            work.name,
                            ...categories
                        ]
                            .filter(
                                value =>
                                    value !==
                                    null &&
                                    value !==
                                    undefined
                            )
                            .join(" ");


                    const normalizedSearchableText =
                        normalizeText(
                            searchableText
                        )
                            .replace(
                                /[-–—_,.;:!?/\\]+/g,
                                " "
                            );


                    return searchWords.every(
                        word =>
                            normalizedSearchableText
                                .includes(
                                    word
                                )
                    );
                }
            );
    }
/* =====================================================
   ЗАКРЕПЛЁННЫЕ РАБОТЫ — ВВЕРХ
===================================================== */

result.sort(
    (a, b) => {

        const pinnedA =
            a.pinned === true
                ? 1
                : 0;

        const pinnedB =
            b.pinned === true
                ? 1
                : 0;


        if (
            pinnedA !==
            pinnedB
        ) {

            return (
                pinnedB -
                pinnedA
            );
        }


        return (
            (b.createdAt || 0) -
            (a.createdAt || 0)
        );
    }
);


return result;

    return result;
}

/* =========================================================
   МАССОВОЕ УПРАВЛЕНИЕ
========================================================= */

function cleanupSelectedWorkIds() {

    const existingIds =
        new Set(
            works.map(
                work =>
                    String(work.id)
            )
        );


    selectedWorkIds =
        new Set(
            Array.from(
                selectedWorkIds
            ).filter(
                id =>
                    existingIds.has(
                        String(id)
                    )
            )
        );
}


/* ---------------------------------------------------------
   Включить режим выбора
--------------------------------------------------------- */

function enterSelectionMode() {

    if (!works.length) {

        showToast(
            "Пока нет работ для выбора",
            "!"
        );

        return;
    }


    selectionMode = true;

    renderAll();

    requestAnimationFrame(() => {

        const toolbar =
            document.getElementById(
                "massActionsToolbar"
            );

        if (toolbar) {

            toolbar.scrollIntoView({
                behavior: "smooth",
                block: "nearest"
            });

        }

    });
}


/* ---------------------------------------------------------
   Выйти из режима выбора
--------------------------------------------------------- */

function exitSelectionMode(clearSelection = true) {

    selectionMode = false;

    if (clearSelection) {

        selectedWorkIds.clear();

    }

    closeMassModal();

    renderAll();
}


/* ---------------------------------------------------------
   Переключить одну работу
--------------------------------------------------------- */

function toggleWorkSelection(id) {

    const normalizedId =
        String(id);


    if (
        selectedWorkIds.has(
            normalizedId
        )
    ) {

        selectedWorkIds.delete(
            normalizedId
        );

    } else {

        selectedWorkIds.add(
            normalizedId
        );
    }


    renderAll();
}


/* ---------------------------------------------------------
   Выбрать все видимые
--------------------------------------------------------- */

function selectAllVisibleWorks() {

    if (!currentFilteredWorks.length) {

        showToast(
            "В текущем списке нет работ",
            "!"
        );

        return;
    }


    currentFilteredWorks.forEach(
        work => {

            selectedWorkIds.add(
                String(work.id)
            );

        }
    );


    renderAll();

    showToast(
        `Выбрано работ: ${selectedWorkIds.size}`,
        "✓"
    );
}


/* ---------------------------------------------------------
   Снять выбор
--------------------------------------------------------- */

function clearWorkSelection() {

    selectedWorkIds.clear();

    renderAll();
}


/* ---------------------------------------------------------
   Получить выбранные работы
--------------------------------------------------------- */

function getSelectedWorks() {

    cleanupSelectedWorkIds();


    return works.filter(
        work =>
            selectedWorkIds.has(
                String(work.id)
            )
    );
}


/* ---------------------------------------------------------
   Общий стиль кнопки
--------------------------------------------------------- */

function massButtonStyle(
    type = "secondary"
) {

    const base = `
        border:1px solid rgba(255,255,255,.13);
        border-radius:12px;
        padding:10px 14px;
        min-height:42px;
        cursor:pointer;
        font-family:inherit;
        font-size:14px;
        font-weight:600;
        transition:.2s ease;
        white-space:nowrap;
    `;


    if (type === "primary") {

        return base + `
            background:linear-gradient(
                135deg,
                #7c3aed,
                #ec4899
            );
            color:#fff;
        `;

    }


    if (type === "danger") {

        return base + `
            background:rgba(239,68,68,.12);
            color:#ff8d9b;
            border-color:rgba(239,68,68,.28);
        `;

    }


    return base + `
        background:rgba(255,255,255,.07);
        color:#fff;
    `;
}


/* ---------------------------------------------------------
   Создание панели массового управления
--------------------------------------------------------- */

function createMassActionsToolbar() {

    if (
        document.getElementById(
            "massActionsToolbar"
        )
    ) {
        return;
    }


    if (!elements.gallery) {
        return;
    }


    const toolbar =
        document.createElement(
            "div"
        );


    toolbar.id =
        "massActionsToolbar";


    toolbar.style.cssText = `
        width:100%;
        margin:0 0 20px;
        padding:14px;
        box-sizing:border-box;
        border:1px solid rgba(255,255,255,.10);
        border-radius:18px;
        background:linear-gradient(
            135deg,
            rgba(93,55,140,.22),
            rgba(25,20,45,.72)
        );
        backdrop-filter:blur(14px);
        -webkit-backdrop-filter:blur(14px);
        color:#fff;
    `;


    const parent =
        elements.gallery.parentElement;


    if (parent) {

        parent.insertBefore(
            toolbar,
            elements.gallery
        );

    } else {

        elements.gallery.before(
            toolbar
        );
    }


    toolbar.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-mass-action]"
                );


            if (!button) {
                return;
            }


            const action =
                button.dataset.massAction;


            if (action === "enter") {

                enterSelectionMode();

            }

            if (action === "select-all") {

                selectAllVisibleWorks();

            }

            if (action === "clear-selection") {

                clearWorkSelection();

            }

            if (action === "categories") {

                openMassCategoryModal();

            }

            if (action === "prompt") {

                openMassPromptModal();

            }

            if (action === "delete") {

                deleteSelectedWorks();

            }

            if (action === "cancel") {

                exitSelectionMode();

            }

        }
    );


    renderMassActionsToolbar();
}


/* ---------------------------------------------------------
   Рендер панели
--------------------------------------------------------- */

function renderMassActionsToolbar() {

    const toolbar =
        document.getElementById(
            "massActionsToolbar"
        );


    if (!toolbar) {
        return;
    }


    cleanupSelectedWorkIds();


    if (!selectionMode) {

        toolbar.innerHTML = `
            <div
                style="
                    display:flex;
                    align-items:center;
                    justify-content:space-between;
                    gap:12px;
                    flex-wrap:wrap;
                "
            >

                <div>

                    <div
                        style="
                            font-size:14px;
                            font-weight:700;
                            margin-bottom:3px;
                        "
                    >
                        Массовое управление
                    </div>

                    <div
                        style="
                            font-size:12px;
                            opacity:.62;
                        "
                    >
                        Выбирай несколько работ и меняй их одновременно
                    </div>

                </div>

                <button
                    type="button"
                    data-mass-action="enter"
                    style="${massButtonStyle("primary")}"
                >
                    ☑ Выбрать работы
                </button>

            </div>
        `;

        return;
    }


    const selectedCount =
        selectedWorkIds.size;

    const visibleCount =
        currentFilteredWorks.length;


    toolbar.innerHTML = `
        <div
            style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap:12px;
                flex-wrap:wrap;
            "
        >

            <div>

                <div
                    style="
                        font-size:15px;
                        font-weight:800;
                        margin-bottom:3px;
                    "
                >
                    Выбрано: ${selectedCount}
                </div>

                <div
                    style="
                        font-size:12px;
                        opacity:.62;
                    "
                >
                    На экране сейчас: ${visibleCount}
                </div>

            </div>


            <div
                style="
                    display:flex;
                    align-items:center;
                    gap:8px;
                    flex-wrap:wrap;
                "
            >

                <button
                    type="button"
                    data-mass-action="select-all"
                    style="${massButtonStyle()}"
                    ${visibleCount ? "" : "disabled"}
                >
                    ☑ Выбрать все
                </button>

                <button
                    type="button"
                    data-mass-action="clear-selection"
                    style="${massButtonStyle()}"
                    ${selectedCount ? "" : "disabled"}
                >
                    Снять выбор
                </button>

                <button
                    type="button"
                    data-mass-action="categories"
                    style="${massButtonStyle("primary")}"
                    ${selectedCount ? "" : "disabled"}
                >
                    🏷 Категории
                </button>

                <button
                    type="button"
                    data-mass-action="prompt"
                    style="${massButtonStyle("primary")}"
                    ${selectedCount ? "" : "disabled"}
                >
                    ✎ Промт
                </button>

                <button
                    type="button"
                    data-mass-action="delete"
                    style="${massButtonStyle("danger")}"
                    ${selectedCount ? "" : "disabled"}
                >
                    🗑 Удалить
                </button>

                <button
                    type="button"
                    data-mass-action="cancel"
                    style="${massButtonStyle()}"
                >
                    Отмена
                </button>

            </div>

        </div>
    `;
}


/* ---------------------------------------------------------
   Создание массового модального окна
--------------------------------------------------------- */

function createMassModal() {

    if (
        document.getElementById(
            "massEditModal"
        )
    ) {
        return;
    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "massEditModal";


    modal.className =
        "modal-overlay hidden";


    modal.innerHTML = `

        <div
            class="modal form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="massEditModalTitle"
            style="max-width:720px;"
        >

            <button
                type="button"
                class="modal-close"
                id="closeMassEditModal"
                aria-label="Закрыть"
            >
                ×
            </button>


            <div class="modal-header">

                <div class="modal-kicker">
                    МАССОВОЕ УПРАВЛЕНИЕ
                </div>

                <h2 id="massEditModalTitle">
                    Изменить выбранные работы
                </h2>

                <p id="massEditModalDescription">
                    Изменения будут применены ко всем выбранным работам.
                </p>

            </div>


            <div
                id="massCategoryEditor"
                style="display:none;"
            >

                <div class="form-group">

                    <label>
                        Добавить категории
                    </label>


                    <div
                        id="massSelectedTags"
                        class="selected-tags"
                    >
                    </div>


                    <div
                        class="category-input-wrapper"
                    >

                        <input
                            type="text"
                            id="massCategoryInput"
                            placeholder="Добавить категорию..."
                            autocomplete="off"
                        >

                        <button
                            type="button"
                            id="massAddCategoryButton"
                        >
                            ＋
                        </button>

                    </div>


                    <div
                        id="massCategorySuggestions"
                        class="category-suggestions"
                    >
                    </div>

                </div>


                <div
                    style="
                        margin-top:12px;
                        padding:12px 14px;
                        border-radius:12px;
                        background:rgba(255,255,255,.05);
                        font-size:13px;
                        line-height:1.5;
                        opacity:.78;
                    "
                >
                    Новые категории будут <strong>добавлены</strong>
                    к существующим. Старые категории не удаляются.
                </div>

            </div>


            <div
                id="massPromptEditor"
                style="display:none;"
            >

                <div class="form-group">

                    <label for="massPromptInput">
                        Новый промт
                    </label>

                    <textarea
                        id="massPromptInput"
                        rows="10"
                        placeholder="Введи общий промт для выбранных работ..."
                    ></textarea>

                </div>


                <div
                    style="
                        margin-top:12px;
                        padding:12px 14px;
                        border-radius:12px;
                        background:rgba(255,255,255,.05);
                        font-size:13px;
                        line-height:1.5;
                        opacity:.78;
                    "
                >
                    Если оставить поле пустым,
                    промт у выбранных работ будет очищен.
                </div>

            </div>


            <div
                class="form-actions"
                style="margin-top:20px;"
            >

                <button
                    type="button"
                    class="secondary-button"
                    id="cancelMassEditButton"
                >
                    Отмена
                </button>

                <button
                    type="button"
                    class="primary-button"
                    id="applyMassEditButton"
                >
                    Применить
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    document.getElementById(
        "closeMassEditModal"
    ).addEventListener(
        "click",
        closeMassModal
    );


    document.getElementById(
        "cancelMassEditButton"
    ).addEventListener(
        "click",
        closeMassModal
    );


    document.getElementById(
        "applyMassEditButton"
    ).addEventListener(
        "click",
        applyMassEdit
    );


    document.getElementById(
        "massAddCategoryButton"
    ).addEventListener(
        "click",
        () => {

            addMassCategory(
                document.getElementById(
                    "massCategoryInput"
                ).value
            );

        }
    );


    document.getElementById(
        "massCategoryInput"
    ).addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                addMassCategory(
                    event.target.value
                );
            }
        }
    );


    document.getElementById(
        "massCategoryInput"
    ).addEventListener(
        "input",
        renderMassCategorySuggestions
    );


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {

                closeMassModal();

            }

        }
    );
}


/* ---------------------------------------------------------
   Открыть массовое окно
--------------------------------------------------------- */

function openMassEditModal(mode) {

    createMassModal();


    const selected =
        getSelectedWorks();


    if (!selected.length) {

        showToast(
            "Сначала выбери хотя бы одну работу",
            "!"
        );

        return;
    }


    const modal =
        document.getElementById(
            "massEditModal"
        );


    const title =
        document.getElementById(
            "massEditModalTitle"
        );


    const description =
        document.getElementById(
            "massEditModalDescription"
        );


    const categoryEditor =
        document.getElementById(
            "massCategoryEditor"
        );


    const promptEditor =
        document.getElementById(
            "massPromptEditor"
        );


    massCategories = [];


    document.getElementById(
        "massCategoryInput"
    ).value = "";


    document.getElementById(
        "massPromptInput"
    ).value = "";


    categoryEditor.style.display =
        mode === "categories"
            ? "block"
            : "none";


    promptEditor.style.display =
        mode === "prompt"
            ? "block"
            : "none";


    if (mode === "categories") {

        title.textContent =
            "Добавить категории";

        description.textContent =
            `Выбрано работ: ${selected.length}. Новые категории будут добавлены к ним.`;

        renderMassSelectedCategories();
        renderMassCategorySuggestions();

    } else {

        title.textContent =
            "Изменить промт";

        description.textContent =
            `Новый промт будет установлен для ${selected.length} выбранных работ.`;

    }


    modal.dataset.mode =
        mode;


    modal.classList.remove(
        "hidden"
    );


    document.body.style.overflow =
        "hidden";
}


/* ---------------------------------------------------------
   Обёртки
--------------------------------------------------------- */

function openMassCategoryModal() {

    openMassEditModal(
        "categories"
    );
}


function openMassPromptModal() {

    openMassEditModal(
        "prompt"
    );
}


/* ---------------------------------------------------------
   Закрытие массового окна
--------------------------------------------------------- */

function closeMassModal() {

    const modal =
        document.getElementById(
            "massEditModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    document.body.style.overflow =
        "";
}


/* ---------------------------------------------------------
   Категории массового редактирования
--------------------------------------------------------- */

function addMassCategory(value) {

    const category =
        String(value || "")
            .trim()
            .replace(
                /\s+/g,
                " "
            );


    if (!category) {
        return;
    }


    const exists =
        massCategories.some(
            item =>
                normalizeText(
                    item
                ) ===
                normalizeText(
                    category
                )
        );


    if (exists) {

        showToast(
            "Такая категория уже добавлена",
            "!"
        );

        return;
    }


    massCategories.push(
        category
    );


    massCategories.sort(
        (a, b) =>
            a.localeCompare(
                b,
                "ru"
            )
    );


    document.getElementById(
        "massCategoryInput"
    ).value = "";


    renderMassSelectedCategories();

    renderMassCategorySuggestions();
}


function removeMassCategory(category) {

    massCategories =
        massCategories.filter(
            item =>
                normalizeText(item) !==
                normalizeText(category)
        );


    renderMassSelectedCategories();

    renderMassCategorySuggestions();
}


function renderMassSelectedCategories() {

    const container =
        document.getElementById(
            "massSelectedTags"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        massCategories
            .map(
                category => `
                    <span class="selected-tag">

                        ${escapeHTML(
                            category
                        )}

                        <button
                            type="button"
                            data-remove-mass-category="${escapeHTML(category)}"
                            title="Удалить"
                        >
                            ×
                        </button>

                    </span>
                `
            )
            .join("");


    container
        .querySelectorAll(
            "[data-remove-mass-category]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeMassCategory(
                        button.dataset
                            .removeMassCategory
                    );

                }
            );

        });
}


function renderMassCategorySuggestions() {

    const container =
        document.getElementById(
            "massCategorySuggestions"
        );


    const input =
        document.getElementById(
            "massCategoryInput"
        );


    if (!container || !input) {
        return;
    }


    const inputValue =
        normalizeText(
            input.value
        );


    const available =
        getAllCategories()
            .filter(
                category => {

                    if (
                        massCategories.some(
                            selected =>
                                normalizeText(
                                    selected
                                ) ===
                                normalizeText(
                                    category
                                )
                        )
                    ) {

                        return false;
                    }


                    if (!inputValue) {
                        return true;
                    }


                    return normalizeText(
                        category
                    ).includes(
                        inputValue
                    );
                }
            )
            .slice(
                0,
                12
            );


    container.innerHTML =
        available
            .map(
                category => `
                    <button
                        type="button"
                        class="suggestion-button"
                        data-mass-suggestion="${escapeHTML(category)}"
                    >
                        + ${escapeHTML(category)}
                    </button>
                `
            )
            .join("");


    container
        .querySelectorAll(
            "[data-mass-suggestion]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    addMassCategory(
                        button.dataset
                            .massSuggestion
                    );

                }
            );

        });
}


/* ---------------------------------------------------------
   Применение массового изменения
--------------------------------------------------------- */

async function applyMassEdit() {

    const modal =
        document.getElementById(
            "massEditModal"
        );


    if (!modal) {
        return;
    }


    const mode =
        modal.dataset.mode;


    const selected =
        getSelectedWorks();


    if (!selected.length) {

        showToast(
            "Нет выбранных работ",
            "!"
        );

        closeMassModal();

        return;
    }


    const applyButton =
        document.getElementById(
            "applyMassEditButton"
        );


    applyButton.disabled =
        true;


    applyButton.textContent =
        "Сохранение...";


    try {

        if (mode === "categories") {

            if (!massCategories.length) {

                showToast(
                    "Добавь хотя бы одну категорию",
                    "!"
                );

                return;
            }


            for (const work of selected) {

                const existingCategories =
                    Array.isArray(
                        work.categories
                    )
                        ? [
                            ...work.categories
                        ]
                        : [];


                const merged =
                    [
                        ...existingCategories
                    ];


                massCategories.forEach(
                    category => {

                        const exists =
                            merged.some(
                                existing =>
                                    normalizeText(
                                        existing
                                    ) ===
                                    normalizeText(
                                        category
                                    )
                            );


                        if (!exists) {

                            merged.push(
                                category
                            );

                        }

                    }
                );


                merged.sort(
                    (a, b) =>
                        a.localeCompare(
                            b,
                            "ru"
                        )
                );


                work.categories =
                    merged;

                work.updatedAt =
                    Date.now();


                await saveWorkToDB(
                    work
                );
            }


            closeMassModal();

            renderAll();


            showToast(
                `Категории обновлены у ${selected.length} работ`,
                "✓"
            );


        } else if (mode === "prompt") {

            const prompt =
                document.getElementById(
                    "massPromptInput"
                ).value;


            for (const work of selected) {

                work.prompt =
                    prompt.trim();

                work.updatedAt =
                    Date.now();


                await saveWorkToDB(
                    work
                );
            }


            closeMassModal();

            renderAll();


            showToast(
                `Промт обновлён у ${selected.length} работ`,
                "✓"
            );
        }

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось применить изменения",
            "!"
        );

    } finally {

        applyButton.disabled =
            false;

        applyButton.textContent =
            "Применить";
    }
}


/* ---------------------------------------------------------
   Массовое удаление
--------------------------------------------------------- */

async function deleteSelectedWorks() {

    const selected =
        getSelectedWorks();


    if (!selected.length) {

        showToast(
            "Сначала выбери работы",
            "!"
        );

        return;
    }


    const confirmed =
        window.confirm(
            `Удалить выбранные работы: ${selected.length}?\n\nФотографии и промты будут удалены без возможности восстановления, если нет резервной копии.`
        );


    if (!confirmed) {
        return;
    }


    const ids =
        selected.map(
            work =>
                work.id
        );


    try {

        await deleteWorksFromDB(
            ids
        );


        works =
            works.filter(
                work =>
                    !selectedWorkIds.has(
                        String(work.id)
                    )
            );


        selectedWorkIds.clear();


        if (
            currentViewWorkId &&
            ids.includes(
                currentViewWorkId
            )
        ) {

            closeViewModal();

        }


        renderAll();


        showToast(
            `Удалено работ: ${selected.length}`,
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось удалить выбранные работы",
            "!"
        );
    }
}


/* =========================================================
   РЕНДЕР
========================================================= */

function renderAll() {

    cleanupSelectedWorkIds();

    renderCategories();

    currentFilteredWorks =
        getFilteredWorks();

    renderGallery();

    updateCounters();

    updateSearchButton();

    renderCategorySuggestions();

    renderMassActionsToolbar();
}


/* =========================================================
   ГАЛЕРЕЯ
========================================================= */

function renderGallery() {

    if (!elements.gallery) {
        return;
    }


    elements.gallery.classList.toggle(
        "compact",
        currentViewMode === "compact"
    );


    if (
        currentFilteredWorks.length ===
        0
    ) {

        elements.gallery.innerHTML =
            "";

        elements.emptyState
            .classList.remove(
                "hidden"
            );

        return;
    }


    elements.emptyState
        .classList.add(
            "hidden"
        );


    elements.gallery.innerHTML =
        currentFilteredWorks
            .map(
                work =>
                    createPhotoCard(
                        work
                    )
            )
            .join("");


    elements.gallery
        .querySelectorAll(
            "[data-open-work]"
        )
        .forEach(element => {

            element.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            "[data-favorite]"
                        )
                    ) {
                        return;
                    }


                    if (
                        event.target.closest(
                            "[data-select-work]"
                        )
                    ) {
                        return;
                    }


                    openViewModal(
                        element.dataset.openWork
                    );
                }
            );
        });


    elements.gallery
        .querySelectorAll(
            "[data-favorite]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async event => {

                    event.stopPropagation();

                    await toggleFavorite(
                        button.dataset.favorite
                    );
                }
            );
        });


    elements.gallery
        .querySelectorAll(
            "[data-select-work]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopPropagation();

                    toggleWorkSelection(
                        button.dataset.selectWork
                    );
                }
            );

        });
            elements.gallery
        .querySelectorAll(
            "[data-copy-card-prompt]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();

                    event.stopPropagation();

                    await copyWorkPromptDirectly(
                        button.dataset
                            .copyCardPrompt,
                        button
                    );
                }
            );
            /* =====================================================
   ЗАКРЕПЛЕНИЕ
===================================================== */

elements.gallery
    .querySelectorAll(
        "[data-pin-card]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();

                    event.stopPropagation();


                    await togglePinned(
                        button.dataset
                            .pinCard
                    );
                }
            );
        }
    );

        });
        /* =====================================================
   БЫСТРОЕ РЕДАКТИРОВАНИЕ
===================================================== */

elements.gallery
    .querySelectorAll(
        "[data-edit-card]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopPropagation();


                    openEditModal(
                        button.dataset
                            .editCard
                    );
                }
            );
        }
    );


/* =====================================================
   БЫСТРОЕ УДАЛЕНИЕ
===================================================== */

elements.gallery
    .querySelectorAll(
        "[data-delete-card]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                async event => {

                    event.preventDefault();

                    event.stopPropagation();


                    const id =
                        button.dataset
                            .deleteCard;


                    const work =
                        works.find(
                            item =>
                                String(
                                    item.id
                                ) ===
                                String(
                                    id
                                )
                        );


                    if (!work) {
                        return;
                    }


                    const confirmed =
                        window.confirm(
                            `Удалить работу «${
                                work.title ||
                                "Без названия"
                            }»?\n\nФотография и промт будут удалены из библиотеки.`
                        );


                    if (!confirmed) {
                        return;
                    }


                    await deleteWork(
                        id
                    );
                }
            );
        }
    );
}


/* =========================================================
   КАРТОЧКА
========================================================= */

function createPhotoCard(work) {

    const categories =
        Array.isArray(
            work.categories
        )
            ? work.categories
            : [];


    const tags =
        categories
            .slice(0, 3)
            .map(
                category => `
                    <span class="photo-tag">
                        ${escapeHTML(category)}
                    </span>
                `
            )
            .join("");


    const favoriteSymbol =
        work.favorite
            ? "★"
            : "☆";


    const favoriteClass =
        work.favorite
            ? "active"
            : "";


    const isSelected =
        selectedWorkIds.has(
            String(work.id)
        );


    const selectionControl =
        selectionMode
            ? `
                <button
                    type="button"
                    data-select-work="${escapeHTML(work.id)}"
                    title="${isSelected ? "Снять выбор" : "Выбрать"}"
                    aria-label="${isSelected ? "Снять выбор" : "Выбрать"}"
                    style="
                        position:absolute;
                        top:10px;
                        left:10px;
                        z-index:5;
                        width:34px;
                        height:34px;
                        border-radius:10px;
                        border:1px solid rgba(255,255,255,.28);
                        background:${isSelected ? "linear-gradient(135deg,#7c3aed,#ec4899)" : "rgba(10,8,20,.72)"};
                        color:#fff;
                        cursor:pointer;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:18px;
                        box-shadow:0 5px 18px rgba(0,0,0,.25);
                    "
                >
                    ${isSelected ? "✓" : ""}
                </button>
            `
            : "";


    return `
        <article
            class="photo-card"
            data-open-work="${escapeHTML(work.id)}"
            style="${selectionMode && isSelected ? "outline:2px solid rgba(236,72,153,.75);outline-offset:-2px;" : ""}"
        >

            <div class="photo-card-image">

                <img
                    src="${work.imageData || ""}"
                    alt="${escapeHTML(work.title)}"
                    loading="lazy"
                >

                ${selectionControl}

                <button
                    type="button"
                    class="card-favorite ${favoriteClass}"
                    data-favorite="${escapeHTML(work.id)}"
                    title="Избранное"
                    aria-label="Избранное"
                >
                    ${favoriteSymbol}
                </button>

                <div class="photo-card-overlay">

                    <span class="open-label">
                        Открыть промт →
                    </span>

                </div>

            </div>


            <div class="photo-card-content">

                <div class="photo-card-title">
                    ${escapeHTML(work.title)}
                </div>

                <div class="photo-card-tags">
                    ${tags}
                </div>
                <button
    type="button"
    class="card-copy-prompt"
    data-copy-card-prompt="${escapeHTML(work.id)}"
    title="Скопировать промт"
>
    📋 Копировать промт
</button>

            </div>

            <button
    type="button"
    class="card-pin-button ${
        work.pinned === true
            ? "active"
            : ""
    }"
    data-pin-card="${escapeHTML(work.id)}"
    title="${
        work.pinned === true
            ? "Открепить"
            : "Закрепить"
    }"
>
    ${
        work.pinned === true
            ? "📌 Закреплено"
            : "📌 Закрепить"
    }
</button>

            <div class="card-quick-actions">

    <button
        type="button"
        class="card-edit-button"
        data-edit-card="${escapeHTML(work.id)}"
        title="Редактировать"
    >
        ✏️ Редактировать
    </button>

    <button
        type="button"
        class="card-delete-button"
        data-delete-card="${escapeHTML(work.id)}"
        title="Удалить"
    >
        🗑 Удалить
    </button>

</div>

        </article>
    `;
}


/* =========================================================
   СЧЁТЧИКИ
========================================================= */

function updateCounters() {

    if (elements.worksCount) {

        elements.worksCount.textContent =
            currentFilteredWorks.length;
    }


    if (elements.favoritesCount) {

        const count =
            works.filter(
                work =>
                    work.favorite === true
            ).length;

        elements.favoritesCount.textContent =
            count;
    }
}


/* =========================================================
   ПОИСК
========================================================= */

function updateSearchButton() {

    if (!elements.clearSearch) {
        return;
    }

    elements.clearSearch.classList.toggle(
        "visible",
        Boolean(searchQuery)
    );
}


/* =========================================================
   VIEW MODAL
========================================================= */

function openViewModal(id) {

    const work =
        works.find(
            item =>
                item.id === id
        );

    if (!work) {
        return;
    }

    currentViewWorkId =
        work.id;


    elements.viewImage.src =
        work.imageData || "";

    elements.viewImage.alt =
        work.title ||
        "НейроФото";

    elements.viewModalTitle.textContent =
        work.title ||
        "Без названия";

    elements.viewPrompt.textContent =
        work.prompt || "";


    elements.viewCategories.innerHTML =
        (work.categories || [])
            .map(
                category => `
                    <span class="view-category">
                        ${escapeHTML(category)}
                    </span>
                `
            )
            .join("");


    updateViewFavoriteButton(
        work
    );


    elements.viewModal
        .classList.remove(
            "hidden"
        );

    document.body.style.overflow =
        "hidden";
}


function closeViewModal() {

    elements.viewModal
        .classList.add(
            "hidden"
        );

    document.body.style.overflow =
        "";

    currentViewWorkId =
        null;
}


function updateViewFavoriteButton(work) {

    if (!work) {
        return;
    }

    if (work.favorite) {

        elements.viewFavoriteButton
            .classList.add(
                "active"
            );

        elements.viewFavoriteButton.textContent =
            "★ В избранном";

    } else {

        elements.viewFavoriteButton
            .classList.remove(
                "active"
            );

        elements.viewFavoriteButton.textContent =
            "☆ Добавить в избранное";
    }
}


/* =========================================================
   ИЗБРАННОЕ
========================================================= */

async function toggleFavorite(id) {

    const work =
        works.find(
            item =>
                item.id === id
        );

    if (!work) {
        return;
    }

    work.favorite =
        !Boolean(
            work.favorite
        );


    try {

        await saveWorkToDB(
            work
        );

        renderAll();


        if (
            currentViewWorkId === id
        ) {

            updateViewFavoriteButton(
                work
            );
        }


        showToast(
            work.favorite
                ? "Добавлено в избранное"
                : "Удалено из избранного",
            work.favorite
                ? "★"
                : "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось сохранить",
            "!"
        );
    }
}

/* =========================================================
   ЗАКРЕПЛЕНИЕ РАБОТЫ
========================================================= */

async function togglePinned(id) {

    const work =
        works.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!work) {
        return;
    }


    work.pinned =
        work.pinned !== true;


    work.updatedAt =
        Date.now();


    try {

        await saveWorkToDB(
            work
        );


        const button =
            elements.gallery.querySelector(
                `[data-pin-card="${CSS.escape(String(id))}"]`
            );


        if (!button) {
            return;
        }


        /* =====================================================
           ОБНОВЛЯЕМ КНОПКУ
        ===================================================== */

        button.classList.toggle(
            "active",
            work.pinned === true
        );


        button.textContent =
            work.pinned === true
                ? "📌 Закреплено"
                : "📌 Закрепить";


        button.title =
            work.pinned === true
                ? "Открепить"
                : "Закрепить";


        const card =
            button.closest(
                "[data-open-work]"
            );


        if (!card) {
            return;
        }


        /* =====================================================
           ЗАКРЕПЛЯЕМ
        ===================================================== */

        if (
            work.pinned === true
        ) {

            elements.gallery.prepend(
                card
            );


        }


        /* =====================================================
           ОТКРЕПЛЯЕМ
        ===================================================== */

        else {

            /*
               Ищем первую незакреплённую карточку,
               которая была создана раньше этой работы.
            */

            const cards =
                Array.from(
                    elements.gallery.querySelectorAll(
                        "[data-open-work]"
                    )
                );


            let insertBefore =
                null;


            for (
                const currentCard
                of cards
            ) {

                if (
                    currentCard ===
                    card
                ) {
                    continue;
                }


                const currentId =
                    currentCard.dataset
                        .openWork;


                const currentWork =
                    works.find(
                        item =>
                            String(
                                item.id
                            ) ===
                            String(
                                currentId
                            )
                    );


                if (!currentWork) {
                    continue;
                }


                /*
                   Закреплённые карточки пропускаем.
                */

                if (
                    currentWork.pinned ===
                    true
                ) {
                    continue;
                }


                /*
                   Ставим работу перед первой
                   более старой работой.
                */

                if (
                    (
                        currentWork.createdAt ||
                        0
                    ) <
                    (
                        work.createdAt ||
                        0
                    )
                ) {

                    insertBefore =
                        currentCard;

                    break;
                }
            }


            if (
                insertBefore
            ) {

                elements.gallery.insertBefore(
                    card,
                    insertBefore
                );

            } else {

                elements.gallery.appendChild(
                    card
                );
            }
        }


        showToast(
            work.pinned
                ? "Работа закреплена"
                : "Работа откреплена",
            work.pinned
                ? "📌"
                : "✓"
        );


    } catch (error) {

        console.error(
            error
        );


        showToast(
            "Не удалось изменить закрепление",
            "!"
        );
    }
}
/* =========================================================
   ФОРМА
========================================================= */

function openAddModal() {

    editingWorkId = null;

    elements.workForm.reset();

    elements.editWorkId.value =
        "";

    selectedCategories = [];

    currentImageData =
        null;

    currentImageMimeType =
        null;


    elements.formModalTitle.textContent =
        "Добавить НейроФото";

    elements.saveButtonText.textContent =
        "Сохранить работу";


    resetImagePreview();

    renderSelectedCategories();

    renderCategorySuggestions();

    updateCharactersCount();


    elements.formModal
        .classList.remove(
            "hidden"
        );

    document.body.style.overflow =
        "hidden";
}


function openEditModal(id) {

    const work =
        works.find(
            item =>
                item.id === id
        );

    if (!work) {
        return;
    }


    editingWorkId =
        work.id;

    elements.editWorkId.value =
        work.id;


    elements.formModalTitle.textContent =
        "Редактировать работу";

    elements.saveButtonText.textContent =
        "Сохранить изменения";


    elements.titleInput.value =
        work.title || "";

    elements.promptInput.value =
        work.prompt || "";


    selectedCategories =
        Array.isArray(
            work.categories
        )
            ? [...work.categories]
            : [];


    currentImageData =
        work.imageData || null;

    currentImageMimeType =
        work.imageMimeType || null;


    if (work.imageData) {

        elements.imagePreview.src =
            work.imageData;

        elements.imagePreview
            .classList.remove(
                "hidden"
            );

        elements.uploadPlaceholder
            .classList.add(
                "hidden"
            );

        elements.fileName.textContent =
            "Текущая фотография";

    } else {

        resetImagePreview();
    }


    renderSelectedCategories();

    renderCategorySuggestions();

    updateCharactersCount();


    elements.formModal
        .classList.remove(
            "hidden"
        );

    document.body.style.overflow =
        "hidden";
}


function closeFormModal() {

    elements.formModal
        .classList.add(
            "hidden"
        );

    document.body.style.overflow =
        "";

    editingWorkId =
        null;
}


function resetImagePreview() {

    elements.imagePreview.src =
        "";

    elements.imagePreview
        .classList.add(
            "hidden"
        );

    elements.uploadPlaceholder
        .classList.remove(
            "hidden"
        );

    elements.fileName.textContent =
        "";
}


/* =========================================================
   ОБРАБОТКА ОДНОГО ИЗОБРАЖЕНИЯ
========================================================= */

async function handleImageFile(file) {

    if (!file) {
        return;
    }


    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        showToast(
            "Выбери JPG, PNG, WEBP или GIF",
            "!"
        );

        return;
    }


    try {

        const result =
            await prepareImage(
                file
            );


        currentImageData =
            result.dataUrl;

        currentImageMimeType =
            result.mimeType;


        elements.imagePreview.src =
            result.dataUrl;

        elements.imagePreview
            .classList.remove(
                "hidden"
            );

        elements.uploadPlaceholder
            .classList.add(
                "hidden"
            );

        elements.fileName.textContent =
            `${file.name} · ${formatBytes(file.size)}`;

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось обработать фотографию",
            "!"
        );
    }
}


/* =========================================================
   ОБРАБОТКА ИЗОБРАЖЕНИЯ
========================================================= */

function prepareImage(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload = event => {

                const originalData =
                    event.target.result;


                const image =
                    new Image();


                image.onload = () => {

                    const maxSize =
                        1800;

                    let width =
                        image.naturalWidth;

                    let height =
                        image.naturalHeight;


                    if (
                        width > maxSize ||
                        height > maxSize
                    ) {

                        const ratio =
                            Math.min(
                                maxSize /
                                    width,
                                maxSize /
                                    height
                            );

                        width =
                            Math.round(
                                width *
                                ratio
                            );

                        height =
                            Math.round(
                                height *
                                ratio
                            );
                    }


                    const canvas =
                        document.createElement(
                            "canvas"
                        );

                    canvas.width =
                        width;

                    canvas.height =
                        height;


                    const context =
                        canvas.getContext(
                            "2d"
                        );


                    context.drawImage(
                        image,
                        0,
                        0,
                        width,
                        height
                    );


                    const dataUrl =
                        canvas.toDataURL(
                            "image/jpeg",
                            0.88
                        );


                    resolve({
                        dataUrl,
                        mimeType:
                            "image/jpeg"
                    });
                };


                image.onerror =
                    reject;


                image.src =
                    originalData;
            };


            reader.onerror =
                reject;


            reader.readAsDataURL(
                file
            );
        }
    );
}


/* =========================================================
   КАТЕГОРИИ В ФОРМЕ
========================================================= */

function addSelectedCategory(value) {

    const category =
        String(value || "")
            .trim()
            .replace(
                /\s+/g,
                " "
            );


    if (!category) {
        return;
    }


    const exists =
        selectedCategories.some(
            item =>
                normalizeText(
                    item
                ) ===
                normalizeText(
                    category
                )
        );


    if (exists) {

        showToast(
            "Такая категория уже добавлена",
            "!"
        );

        return;
    }


    selectedCategories.push(
        category
    );

    selectedCategories.sort(
        (a, b) =>
            a.localeCompare(
                b,
                "ru"
            )
    );


    elements.categoryInput.value =
        "";

    renderSelectedCategories();

    renderCategorySuggestions();
}


function removeSelectedCategory(
    category
) {

    selectedCategories =
        selectedCategories.filter(
            item =>
                normalizeText(
                    item
                ) !==
                normalizeText(
                    category
                )
        );

    renderSelectedCategories();

    renderCategorySuggestions();
}


function renderSelectedCategories() {

    if (!elements.selectedTags) {
        return;
    }


    elements.selectedTags.innerHTML =
        selectedCategories
            .map(
                category => `
                    <span class="selected-tag">

                        ${escapeHTML(
                            category
                        )}

                        <button
                            type="button"
                            data-remove-category="${escapeHTML(category)}"
                            title="Удалить"
                        >
                            ×
                        </button>

                    </span>
                `
            )
            .join("");


    elements.selectedTags
        .querySelectorAll(
            "[data-remove-category]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeSelectedCategory(
                        button.dataset
                            .removeCategory
                    );
                }
            );
        });
}


function renderCategorySuggestions() {

    if (
        !elements.categorySuggestions
    ) {
        return;
    }


    const inputValue =
        normalizeText(
            elements.categoryInput.value
        );


    const available =
        getAllCategories()
            .filter(
                category => {

                    if (
                        selectedCategories.some(
                            selected =>
                                normalizeText(
                                    selected
                                ) ===
                                normalizeText(
                                    category
                                )
                        )
                    ) {
                        return false;
                    }

                    if (!inputValue) {
                        return true;
                    }

                    return normalizeText(
                        category
                    ).includes(
                        inputValue
                    );
                }
            )
            .slice(
                0,
                12
            );


    elements.categorySuggestions.innerHTML =
        available
            .map(
                category => `
                    <button
                        type="button"
                        class="suggestion-button"
                        data-suggestion="${escapeHTML(category)}"
                    >
                        + ${escapeHTML(category)}
                    </button>
                `
            )
            .join("");


    elements.categorySuggestions
        .querySelectorAll(
            "[data-suggestion]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    addSelectedCategory(
                        button.dataset
                            .suggestion
                    );
                }
            );
        });
}


/* =========================================================
   СЧЁТЧИК ПРОМТА
========================================================= */

function updateCharactersCount() {

    if (!elements.charactersCount) {
        return;
    }

    elements.charactersCount.textContent =
        elements.promptInput.value.length;
}


/* =========================================================
   СОХРАНЕНИЕ ОДНОЙ РАБОТЫ
========================================================= */

async function handleFormSubmit(event) {

    event.preventDefault();


    const title =
        elements.titleInput.value.trim();

    const prompt =
        elements.promptInput.value.trim();


    if (!title) {

        showToast(
            "Напиши название работы",
            "!"
        );

        elements.titleInput.focus();

        return;
    }


    if (!prompt) {

        showToast(
            "Добавь промт",
            "!"
        );

        elements.promptInput.focus();

        return;
    }


    if (!currentImageData) {

        showToast(
            "Добавь фотографию",
            "!"
        );

        return;
    }


    let work;


    if (editingWorkId) {

        const existing =
            works.find(
                item =>
                    item.id ===
                    editingWorkId
            );


        if (!existing) {
            return;
        }


        work = {

            ...existing,

            title,

            prompt,

            categories:
                [...selectedCategories],

            imageData:
                currentImageData,

            imageMimeType:
                currentImageMimeType ||
                existing.imageMimeType ||
                "image/jpeg",

            updatedAt:
                Date.now()
        };

    } else {

        work = {

            id:
                generateId(),

            title,

            prompt,

            categories:
                [...selectedCategories],

            imageData:
                currentImageData,

            imageMimeType:
                currentImageMimeType ||
                "image/jpeg",

            favorite:
                false,

            createdAt:
                Date.now(),

            updatedAt:
                Date.now()
        };
    }


    try {

        await saveWorkToDB(
            work
        );


        const index =
            works.findIndex(
                item =>
                    item.id ===
                    work.id
            );


        if (index >= 0) {

            works[index] =
                work;

        } else {

            works.unshift(
                work
            );
        }


        works.sort(
            (a, b) =>
                (b.createdAt || 0) -
                (a.createdAt || 0)
        );


        const wasEditing =
            Boolean(
                editingWorkId
            );


        closeFormModal();

        renderAll();

        resetFormState();


        showToast(
            wasEditing
                ? "Работа обновлена"
                : "Работа добавлена",
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось сохранить работу",
            "!"
        );
    }
}


function resetFormState() {

    editingWorkId =
        null;

    selectedCategories =
        [];

    currentImageData =
        null;

    currentImageMimeType =
        null;
}


/* =========================================================
   МАССОВАЯ ЗАГРУЗКА
========================================================= */

/*
   Этот раздел НЕ МЕНЯЛСЯ.
   Существующая массовая загрузка фотографий
   полностью сохранена.
*/

function createBulkModal() {

    if (
        document.getElementById(
            "bulkModal"
        )
    ) {
        return;
    }


    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "bulkModal";

    modal.className =
        "modal-overlay hidden";


    modal.innerHTML = `

        <div
            class="modal form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulkModalTitle"
        >

            <button
                type="button"
                class="modal-close"
                id="closeBulkModal"
                aria-label="Закрыть"
            >
                ×
            </button>


            <div class="modal-header">

                <div class="modal-kicker">
                    МАССОВАЯ ЗАГРУЗКА
                </div>

                <h2 id="bulkModalTitle">
                    Добавить несколько НейроФото
                </h2>

                <p>
                    Выбери сразу несколько фотографий.
                    Общий промт и категории можно применить ко всем.
                </p>

            </div>


            <div
                id="bulkDropArea"
                class="upload-area"
                style="margin-bottom:18px;"
            >

                <input
                    type="file"
                    id="bulkImageInput"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                >

                <div class="upload-placeholder">

                    <div class="upload-icon">
                        ＋
                    </div>

                    <strong>
                        Выбрать несколько фотографий
                    </strong>

                    <span>
                        Можно выбрать сразу много файлов
                    </span>

                </div>

            </div>


            <div
                id="bulkCounter"
                style="
                    margin-bottom:14px;
                    font-weight:600;
                "
            >
                Фотографий выбрано: 0
            </div>


            <div
                id="bulkPreview"
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(auto-fill,minmax(120px,1fr));
                    gap:12px;
                    max-height:360px;
                    overflow:auto;
                    margin-bottom:20px;
                "
            >
            </div>


            <div class="form-group">

                <label for="bulkTitlePrefix">
                    Название

                    <small
                        style="
                            opacity:.65;
                            font-weight:400;
                        "
                    >
                        Если оставить пустым —
                        возьмём имя файла
                    </small>
                </label>

                <input
                    type="text"
                    id="bulkTitlePrefix"
                    placeholder="Например: Осенняя фотосессия"
                >

            </div>


            <div class="form-group">

                <label for="bulkPromptInput">
                    Общий промт
                </label>

                <textarea
                    id="bulkPromptInput"
                    rows="6"
                    placeholder="Если промт одинаковый для всех фотографий — вставь его сюда. Можно оставить пустым и добавить промты позже."
                ></textarea>

            </div>


            <div class="form-group">

                <label>
                    Общие категории
                </label>


                <div
                    id="bulkSelectedTags"
                    class="selected-tags"
                >
                </div>


                <div
                    class="category-input-wrapper"
                >

                    <input
                        type="text"
                        id="bulkCategoryInput"
                        placeholder="Добавить категорию..."
                        autocomplete="off"
                    >

                    <button
                        type="button"
                        id="bulkAddCategoryButton"
                    >
                        ＋
                    </button>

                </div>


                <div
                    id="bulkCategorySuggestions"
                    class="category-suggestions"
                >
                </div>

            </div>


            <div
                class="form-actions"
                style="margin-top:20px;"
            >

                <button
                    type="button"
                    class="secondary-button"
                    id="cancelBulkButton"
                >
                    Отмена
                </button>

                <button
                    type="button"
                    class="primary-button"
                    id="saveBulkButton"
                >
                    <span>
                        Сохранить все
                    </span>
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    bindBulkModalEvents();
}


function bindBulkModalEvents() {

    const modal =
        document.getElementById(
            "bulkModal"
        );

    const closeButton =
        document.getElementById(
            "closeBulkModal"
        );

    const cancelButton =
        document.getElementById(
            "cancelBulkButton"
        );

    const input =
        document.getElementById(
            "bulkImageInput"
        );

    const dropArea =
        document.getElementById(
            "bulkDropArea"
        );

    const categoryInput =
        document.getElementById(
            "bulkCategoryInput"
        );

    const addCategoryButton =
        document.getElementById(
            "bulkAddCategoryButton"
        );

    const saveButton =
        document.getElementById(
            "saveBulkButton"
        );


    closeButton.addEventListener(
        "click",
        closeBulkModal
    );


    cancelButton.addEventListener(
        "click",
        closeBulkModal
    );


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {

                closeBulkModal();
            }
        }
    );


    input.addEventListener(
        "change",
        event => {

            addBulkFiles(
                event.target.files
            );

            input.value = "";
        }
    );


    dropArea.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            dropArea.classList.add(
                "dragover"
            );
        }
    );


    dropArea.addEventListener(
        "dragleave",
        () => {

            dropArea.classList.remove(
                "dragover"
            );
        }
    );


    dropArea.addEventListener(
        "drop",
        event => {

            event.preventDefault();

            dropArea.classList.remove(
                "dragover"
            );

            addBulkFiles(
                event.dataTransfer.files
            );
        }
    );


    addCategoryButton.addEventListener(
        "click",
        () => {

            addBulkCategory(
                categoryInput.value
            );
        }
    );


    categoryInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                addBulkCategory(
                    categoryInput.value
                );
            }
        }
    );


    categoryInput.addEventListener(
        "input",
        renderBulkCategorySuggestions
    );


    saveButton.addEventListener(
        "click",
        saveBulkWorks
    );
}


function openBulkModal() {

    createBulkModal();


    bulkFiles = [];

    bulkSelectedCategories = [];

    bulkCommonPrompt = "";

    bulkCommonTitlePrefix = "";


    document.getElementById(
        "bulkTitlePrefix"
    ).value = "";


    document.getElementById(
        "bulkPromptInput"
    ).value = "";


    document.getElementById(
        "bulkCategoryInput"
    ).value = "";


    renderBulkSelectedCategories();

    renderBulkCategorySuggestions();

    renderBulkPreview();


    const modal =
        document.getElementById(
            "bulkModal"
        );


    modal.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";
}


function closeBulkModal() {

    const modal =
        document.getElementById(
            "bulkModal"
        );

    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );

    document.body.style.overflow =
        "";
}


function addBulkFiles(fileList) {

    if (!fileList) {
        return;
    }


    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif"
    ];


    const incoming =
        Array.from(
            fileList
        );


    let added = 0;


    incoming.forEach(file => {

        if (
            !allowedTypes.includes(
                file.type
            )
        ) {

            return;
        }


        const duplicate =
            bulkFiles.some(
                item =>
                    item.name ===
                        file.name &&
                    item.size ===
                        file.size &&
                    item.lastModified ===
                        file.lastModified
            );


        if (duplicate) {
            return;
        }


        bulkFiles.push({
            id: generateId(),
            file
        });


        added++;
    });


    if (added < incoming.length) {

        showToast(
            `Добавлено фотографий: ${added}`,
            added ? "✓" : "!"
        );
    }


    renderBulkPreview();
}


function removeBulkFile(id) {

    bulkFiles =
        bulkFiles.filter(
            item =>
                item.id !== id
        );

    renderBulkPreview();
}


function renderBulkPreview() {

    const preview =
        document.getElementById(
            "bulkPreview"
        );

    const counter =
        document.getElementById(
            "bulkCounter"
        );


    if (!preview || !counter) {
        return;
    }


    counter.textContent =
        `Фотографий выбрано: ${bulkFiles.length}`;


    if (!bulkFiles.length) {

        preview.innerHTML = `
            <div
                style="
                    grid-column:1/-1;
                    padding:24px;
                    text-align:center;
                    opacity:.65;
                "
            >
                Здесь появятся выбранные фотографии
            </div>
        `;

        return;
    }


    preview.innerHTML =
        bulkFiles
            .map(
                item => `
                    <div
                        data-bulk-item="${escapeHTML(item.id)}"
                        style="
                            position:relative;
                            border-radius:12px;
                            overflow:hidden;
                            border:1px solid rgba(255,255,255,.12);
                            background:rgba(255,255,255,.04);
                        "
                    >

                        <img
                            src=""
                            data-bulk-preview-image="${escapeHTML(item.id)}"
                            alt=""
                            style="
                                display:block;
                                width:100%;
                                aspect-ratio:1;
                                object-fit:cover;
                            "
                        >

                        <button
                            type="button"
                            data-remove-bulk="${escapeHTML(item.id)}"
                            style="
                                position:absolute;
                                top:6px;
                                right:6px;
                                width:28px;
                                height:28px;
                                border:0;
                                border-radius:50%;
                                cursor:pointer;
                                font-size:18px;
                            "
                            title="Убрать"
                        >
                            ×
                        </button>

                        <div
                            style="
                                padding:7px;
                                font-size:12px;
                                white-space:nowrap;
                                overflow:hidden;
                                text-overflow:ellipsis;
                            "
                            title="${escapeHTML(item.file.name)}"
                        >
                            ${escapeHTML(
                                getFileNameWithoutExtension(
                                    item.file.name
                                )
                            )}
                        </div>

                    </div>
                `
            )
            .join("");


    bulkFiles.forEach(item => {

        const image =
            preview.querySelector(
                `[data-bulk-preview-image="${CSS.escape(item.id)}"]`
            );

        if (!image) {
            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            event => {

                image.src =
                    event.target.result;
            };


        reader.readAsDataURL(
            item.file
        );
    });


    preview
        .querySelectorAll(
            "[data-remove-bulk]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeBulkFile(
                        button.dataset
                            .removeBulk
                    );
                }
            );
        });
}


/* =========================================================
   КАТЕГОРИИ МАССОВОЙ ЗАГРУЗКИ
========================================================= */

function addBulkCategory(value) {

    const category =
        String(value || "")
            .trim()
            .replace(
                /\s+/g,
                " "
            );


    if (!category) {
        return;
    }


    const exists =
        bulkSelectedCategories.some(
            item =>
                normalizeText(
                    item
                ) ===
                normalizeText(
                    category
                )
        );


    if (exists) {

        showToast(
            "Такая категория уже добавлена",
            "!"
        );

        return;
    }


    bulkSelectedCategories.push(
        category
    );

    bulkSelectedCategories.sort(
        (a, b) =>
            a.localeCompare(
                b,
                "ru"
            )
    );


    document.getElementById(
        "bulkCategoryInput"
    ).value = "";


    renderBulkSelectedCategories();

    renderBulkCategorySuggestions();
}


function removeBulkCategory(
    category
) {

    bulkSelectedCategories =
        bulkSelectedCategories.filter(
            item =>
                normalizeText(
                    item
                ) !==
                normalizeText(
                    category
                )
        );


    renderBulkSelectedCategories();

    renderBulkCategorySuggestions();
}


function renderBulkSelectedCategories() {

    const container =
        document.getElementById(
            "bulkSelectedTags"
        );

    if (!container) {
        return;
    }


    container.innerHTML =
        bulkSelectedCategories
            .map(
                category => `
                    <span class="selected-tag">

                        ${escapeHTML(
                            category
                        )}

                        <button
                            type="button"
                            data-remove-bulk-category="${escapeHTML(category)}"
                        >
                            ×
                        </button>

                    </span>
                `
            )
            .join("");


    container
        .querySelectorAll(
            "[data-remove-bulk-category]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeBulkCategory(
                        button.dataset
                            .removeBulkCategory
                    );
                }
            );
        });
}


function renderBulkCategorySuggestions() {

    const container =
        document.getElementById(
            "bulkCategorySuggestions"
        );

    const input =
        document.getElementById(
            "bulkCategoryInput"
        );


    if (!container || !input) {
        return;
    }


    const inputValue =
        normalizeText(
            input.value
        );


    const available =
        getAllCategories()
            .filter(
                category => {

                    if (
                        bulkSelectedCategories.some(
                            selected =>
                                normalizeText(
                                    selected
                                ) ===
                                normalizeText(
                                    category
                                )
                        )
                    ) {
                        return false;
                    }


                    if (!inputValue) {
                        return true;
                    }


                    return normalizeText(
                        category
                    ).includes(
                        inputValue
                    );
                }
            )
            .slice(
                0,
                12
            );


    container.innerHTML =
        available
            .map(
                category => `
                    <button
                        type="button"
                        class="suggestion-button"
                        data-bulk-suggestion="${escapeHTML(category)}"
                    >
                        + ${escapeHTML(category)}
                    </button>
                `
            )
            .join("");


    container
        .querySelectorAll(
            "[data-bulk-suggestion]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    addBulkCategory(
                        button.dataset
                            .bulkSuggestion
                    );
                }
            );
        });
}


/* =========================================================
   СОХРАНЕНИЕ МАССОВОЙ ЗАГРУЗКИ
========================================================= */

async function saveBulkWorks() {

    if (!bulkFiles.length) {

        showToast(
            "Сначала выбери фотографии",
            "!"
        );

        return;
    }


    const prompt =
        document.getElementById(
            "bulkPromptInput"
        ).value.trim();


    const titlePrefix =
        document.getElementById(
            "bulkTitlePrefix"
        ).value.trim();


    const saveButton =
        document.getElementById(
            "saveBulkButton"
        );


    saveButton.disabled =
        true;

    saveButton.innerHTML =
        "<span>Обработка...</span>";


    let savedCount = 0;


    try {

        for (
            let index = 0;
            index < bulkFiles.length;
            index++
        ) {

            const item =
                bulkFiles[index];


            try {

                const result =
                    await prepareImage(
                        item.file
                    );


                let title =
                    getFileNameWithoutExtension(
                        item.file.name
                    );


                if (titlePrefix) {

                    title =
                        `${titlePrefix} ${String(index + 1).padStart(2, "0")}`;
                }


                const work = {

                    id:
                        generateId(),

                    title,

                    prompt,

                    categories:
                        [
                            ...bulkSelectedCategories
                        ],

                    imageData:
                        result.dataUrl,

                    imageMimeType:
                        result.mimeType,

                    favorite:
                        false,

                    createdAt:
                        Date.now() +
                        index,

                    updatedAt:
                        Date.now()
                };


                await saveWorkToDB(
                    work
                );


                works.unshift(
                    work
                );


                savedCount++;


            } catch (error) {

                console.error(
                    "Ошибка файла:",
                    item.file.name,
                    error
                );
            }
        }


        works.sort(
            (a, b) =>
                (b.createdAt || 0) -
                (a.createdAt || 0)
        );


        closeBulkModal();

        renderAll();


        showToast(
            `Добавлено фотографий: ${savedCount}`,
            "✓"
        );


        bulkFiles = [];

        bulkSelectedCategories = [];


    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось сохранить фотографии",
            "!"
        );

    } finally {

        saveButton.disabled =
            false;

        saveButton.innerHTML =
            "<span>Сохранить все</span>";
    }
}


/* =========================================================
   ДОБАВЛЯЕМ КНОПКУ МАССОВОЙ ЗАГРУЗКИ
========================================================= */

function addBulkUploadButton() {

    if (
        document.getElementById(
            "openBulkButton"
        )
    ) {
        return;
    }


    const header =
        document.querySelector(
            "#formModal .modal-header"
        );


    if (!header) {
        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";

    button.id =
        "openBulkButton";

    button.className =
        "secondary-button";

    button.style.marginTop =
        "12px";

    button.textContent =
        "＋ Массовая загрузка фотографий";


    button.addEventListener(
        "click",
        () => {

            closeFormModal();

            openBulkModal();
        }
    );


    header.appendChild(
        button
    );
}


/* =========================================================
   УДАЛЕНИЕ РАБОТЫ
========================================================= */

async function deleteWork(id) {

    const work =
        works.find(
            item =>
                item.id === id
        );

    if (!work) {
        return;
    }


    const confirmed =
        window.confirm(
            `Удалить работу «${work.title}»?\n\nФотография и промт будут удалены.`
        );


    if (!confirmed) {
        return;
    }


    try {

        await deleteWorkFromDB(
            id
        );


        works =
            works.filter(
                item =>
                    item.id !== id
            );


        selectedWorkIds.delete(
            String(id)
        );


        if (
            currentViewWorkId === id
        ) {

            closeViewModal();
        }


        renderAll();


        showToast(
            "Работа удалена",
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось удалить работу",
            "!"
        );
    }
}


/* =========================================================
   КОПИРОВАНИЕ ПРОМТА
========================================================= */

async function copyPrompt() {

    if (!currentViewWorkId) {
        return;
    }


    const work =
        works.find(
            item =>
                item.id ===
                currentViewWorkId
        );


    if (!work || !work.prompt) {

        showToast(
            "У этой работы пока нет промта",
            "!"
        );

        return;
    }


    try {

        await navigator.clipboard.writeText(
            work.prompt
        );


        showToast(
            "Промт скопирован",
            "✓"
        );


        elements.copyPromptButton.innerHTML =
            "<span>✓</span> Скопировано";


        setTimeout(() => {

            elements.copyPromptButton.innerHTML =
                "<span>▣</span> Копировать";

        }, 1800);

    } catch (error) {

        const textarea =
            document.createElement(
                "textarea"
            );

        textarea.value =
            work.prompt;

        textarea.style.position =
            "fixed";

        textarea.style.opacity =
            "0";

        document.body.appendChild(
            textarea
        );

        textarea.select();

        document.execCommand(
            "copy"
        );

        textarea.remove();


        showToast(
            "Промт скопирован",
            "✓"
        );
    }
}

/* =========================================================
   КОПИРОВАНИЕ ПРОМТА ПРЯМО С КАРТОЧКИ
========================================================= */

async function copyWorkPromptDirectly(id, button) {

    const work =
        works.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!work || !work.prompt) {

        showToast(
            "У этой работы нет промта",
            "!"
        );

        return;
    }

    try {

        await navigator.clipboard.writeText(
            work.prompt
        );

    } catch (error) {

        const textarea =
            document.createElement(
                "textarea"
            );

        textarea.value =
            work.prompt;

        textarea.style.position =
            "fixed";

        textarea.style.opacity =
            "0";

        document.body.appendChild(
            textarea
        );

        textarea.select();

        document.execCommand(
            "copy"
        );

        textarea.remove();
    }

    showToast(
        "Промт скопирован",
        "✓"
    );

    if (button) {

        const originalText =
            button.innerHTML;

        button.innerHTML =
            "✓ Скопировано";

        button.disabled =
            true;

        setTimeout(() => {

            button.innerHTML =
                originalText;

            button.disabled =
                false;

        }, 1600);
    }
}

/* =========================================================
   ИЗБРАННОЕ
========================================================= */

function showFavorites() {

    showFavoritesOnly =
        true;

    activeCategory =
        "Все";

    searchQuery =
        "";

    elements.searchInput.value =
        "";

    updateMobileNavigation();

    renderAll();
}


/* =========================================================
   СБРОС ФИЛЬТРОВ
========================================================= */

function resetFilters() {

    activeCategory =
        "Все";

    searchQuery =
        "";

    showFavoritesOnly =
        false;

    elements.searchInput.value =
        "";

    updateMobileNavigation();

    renderAll();
}


/* =========================================================
   ВИД ГАЛЕРЕИ
========================================================= */

function setViewMode(mode) {

    currentViewMode =
        mode;

    elements.gridViewButton
        .classList.toggle(
            "active",
            mode === "grid"
        );

    elements.compactViewButton
        .classList.toggle(
            "active",
            mode === "compact"
        );

    renderGallery();
}


/* =========================================================
   НАСТРОЙКИ
========================================================= */

function openSettings() {

    elements.settingsModal
        .classList.remove(
            "hidden"
        );

    document.body.style.overflow =
        "hidden";
}


function closeSettings() {

    elements.settingsModal
        .classList.add(
            "hidden"
        );

    document.body.style.overflow =
        "";
}


/* =========================================================
   РЕЗЕРВНАЯ КОПИЯ
========================================================= */

async function exportLibrary() {

    try {

        const backup = {

            app:
                "Оксана — промты",

            version:
                1,

            exportedAt:
                new Date().toISOString(),

            works:
                works.map(
                    work => ({
                        ...work
                    })
                )
        };


        const json =
            JSON.stringify(
                backup
            );


        const blob =
            new Blob(
                [json],
                {
                    type:
                        "application/json"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );

        link.href =
            url;

        link.download =
            `oksana-prompts-backup-${getDateForFile()}.json`;

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        URL.revokeObjectURL(
            url
        );


        showToast(
            "Резервная копия создана",
            "↓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось создать копию",
            "!"
        );
    }
}


function getDateForFile() {

    const date =
        new Date();

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );

    return `${year}-${month}-${day}`;
}


/* =========================================================
   ВОССТАНОВЛЕНИЕ
========================================================= */

async function importLibrary(file) {

    if (!file) {
        return;
    }


    try {

        /* =====================================================
           ЧИТАЕМ ФАЙЛ
        ===================================================== */

        const text =
            await file.text();


        if (!text.trim()) {

            throw new Error(
                "Файл пустой"
            );
        }


        let backup;

        try {

            backup =
                JSON.parse(
                    text
                );

        } catch (error) {

            throw new Error(
                "Файл не является корректным JSON"
            );
        }


        /* =====================================================
           ПРОВЕРЯЕМ СТРУКТУРУ
        ===================================================== */

        if (
            !backup ||
            typeof backup !==
                "object"
        ) {

            throw new Error(
                "Неверный формат резервной копии"
            );
        }


        if (
            backup.app !==
                "Оксана — промты"
        ) {

            throw new Error(
                "Это не резервная копия библиотеки «Оксана — промты»"
            );
        }


        if (
            !Array.isArray(
                backup.works
            )
        ) {

            throw new Error(
                "В резервной копии отсутствует список работ"
            );
        }


        /* =====================================================
           СЧИТАЕМ КОРРЕКТНЫЕ РАБОТЫ
        ===================================================== */

        const validWorks =
            backup.works.filter(
                work =>
                    work &&
                    work.id &&
                    work.imageData
            );


        if (!validWorks.length) {

            throw new Error(
                "В резервной копии нет корректных работ с фотографиями"
            );
        }


        /* =====================================================
           ПОДТВЕРЖДЕНИЕ
        ===================================================== */

        const confirmed =
            window.confirm(
                `В резервной копии найдено работ: ${validWorks.length}.\n\n` +
                `В текущей библиотеке: ${works.length}.\n\n` +
                `Существующие работы не будут перезаписаны.`
            );


        if (!confirmed) {
            return;
        }


        /* =====================================================
           ИМПОРТ
        ===================================================== */

        let imported =
            0;

        let skipped =
            0;


        for (
            const backupWork
            of validWorks
        ) {

            const exists =
                works.some(
                    work =>
                        String(
                            work.id
                        ) ===
                        String(
                            backupWork.id
                        )
                );


            /*
               Если работа с таким ID уже есть —
               создаём новый ID, чтобы ничего
               не перезаписать.
            */

            const work = {

                ...backupWork,

                id:
                    exists
                        ? generateId()
                        : backupWork.id,

                categories:
                    Array.isArray(
                        backupWork.categories
                    )
                        ? [
                            ...backupWork.categories
                        ]
                        : [],

                favorite:
                    backupWork.favorite ===
                    true,

                createdAt:
                    backupWork.createdAt ||
                    Date.now(),

                importedAt:
                    Date.now(),

                updatedAt:
                    Date.now()
            };


            try {

                await saveWorkToDB(
                    work
                );

                works.push(
                    work
                );

                imported++;

            } catch (error) {

                console.error(
                    "Ошибка импорта работы:",
                    error
                );

                skipped++;
            }
        }


        /* =====================================================
           ОБНОВЛЯЕМ БИБЛИОТЕКУ
        ===================================================== */

        works.sort(
            (a, b) =>
                (b.createdAt || 0) -
                (a.createdAt || 0)
        );


        renderAll();


        /* =====================================================
           РЕЗУЛЬТАТ
        ===================================================== */

        if (
            skipped > 0
        ) {

            showToast(
                `Импортировано: ${imported}. Пропущено: ${skipped}`,
                "!"
            );

        } else {

            showToast(
                `Восстановлено работ: ${imported}`,
                "✓"
            );
        }


    } catch (error) {

        console.error(
            "Ошибка импорта:",
            error
        );


        showToast(
            error.message ||
                "Не удалось восстановить резервную копию",
            "!"
        );

    }


    elements.importInput.value =
        "";
}

/* =========================================================
   ОЧИСТКА БАЗЫ
========================================================= */

async function handleClearDatabase() {

    if (!works.length) {

        showToast(
            "Библиотека уже пустая",
            "!"
        );

        return;
    }


    const firstConfirm =
        window.confirm(
            "Ты действительно хочешь удалить ВСЕ фотографии и промты?"
        );


    if (!firstConfirm) {
        return;
    }


    const secondConfirm =
        window.confirm(
            "Последнее предупреждение: все работы будут удалены без возможности восстановления, если нет резервной копии."
        );


    if (!secondConfirm) {
        return;
    }


    try {

        await clearDatabase();

        works = [];

        selectedWorkIds.clear();

        selectionMode = false;

        activeCategory =
            "Все";

        searchQuery =
            "";

        showFavoritesOnly =
            false;

        elements.searchInput.value =
            "";


        renderAll();

        closeSettings();


        showToast(
            "Библиотека очищена",
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось очистить библиотеку",
            "!"
        );
    }
}


/* =========================================================
   МОБИЛЬНАЯ НАВИГАЦИЯ
========================================================= */

function updateMobileNavigation() {

    elements.mobileHomeButton
        .classList.toggle(
            "active",
            !showFavoritesOnly
        );


    elements.mobileFavoritesButton
        .classList.toggle(
            "active",
            showFavoritesOnly
        );
}


/* =========================================================
   СОБЫТИЯ
========================================================= */


/* Поиск */

elements.searchInput
    .addEventListener(
        "input",
        event => {

            searchQuery =
                event.target.value;

            showFavoritesOnly =
                false;

            updateMobileNavigation();

            renderAll();
        }
    );


/* Очистка поиска */

elements.clearSearch
    .addEventListener(
        "click",
        resetFilters
    );


/* Все */

elements.showAllButton
    .addEventListener(
        "click",
        resetFilters
    );


/* Сброс */

elements.resetFiltersButton
    .addEventListener(
        "click",
        resetFilters
    );


/* Добавить */

elements.openAddButton
    .addEventListener(
        "click",
        openAddModal
    );


elements.mobileAddButton
    .addEventListener(
        "click",
        openAddModal
    );


/* Избранное */

elements.favoritesButton
    .addEventListener(
        "click",
        showFavorites
    );


elements.mobileFavoritesButton
    .addEventListener(
        "click",
        showFavorites
    );


/* Домой */

elements.mobileHomeButton
    .addEventListener(
        "click",
        resetFilters
    );


/* Логотип */

elements.logoButton
    .addEventListener(
        "click",
        event => {

            event.preventDefault();

            resetFilters();

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    );


/* Вид */

elements.gridViewButton
    .addEventListener(
        "click",
        () => {

            setViewMode(
                "grid"
            );
        }
    );


elements.compactViewButton
    .addEventListener(
        "click",
        () => {

            setViewMode(
                "compact"
            );
        }
    );


/* Просмотр */

elements.closeViewModal
    .addEventListener(
        "click",
        closeViewModal
    );


/* Копирование */

elements.copyPromptButton
    .addEventListener(
        "click",
        copyPrompt
    );


/* Избранное в просмотре */

elements.viewFavoriteButton
    .addEventListener(
        "click",
        async () => {

            if (
                currentViewWorkId
            ) {

                await toggleFavorite(
                    currentViewWorkId
                );
            }
        }
    );


/* Редактирование */

elements.editFromViewButton
    .addEventListener(
        "click",
        () => {

            if (!currentViewWorkId) {
                return;
            }

            const id =
                currentViewWorkId;

            closeViewModal();

            openEditModal(
                id
            );
        }
    );


/* Закрытие формы */

elements.closeFormModal
    .addEventListener(
        "click",
        closeFormModal
    );


elements.cancelFormButton
    .addEventListener(
        "click",
        closeFormModal
    );


/* Сохранение формы */

elements.workForm
    .addEventListener(
        "submit",
        handleFormSubmit
    );


/* Одиночная фотография */

elements.imageInput
    .addEventListener(
        "change",
        event => {

            const file =
                event.target.files[0];

            handleImageFile(
                file
            );
        }
    );


/* Drag & Drop одиночной фотографии */

elements.uploadArea
    .addEventListener(
        "dragover",
        event => {

            event.preventDefault();

            elements.uploadArea
                .classList.add(
                    "dragover"
                );
        }
    );


elements.uploadArea
    .addEventListener(
        "dragleave",
        () => {

            elements.uploadArea
                .classList.remove(
                    "dragover"
                );
        }
    );


elements.uploadArea
    .addEventListener(
        "drop",
        event => {

            event.preventDefault();

            elements.uploadArea
                .classList.remove(
                    "dragover"
                );


            const file =
                event.dataTransfer
                    .files[0];

            handleImageFile(
                file
            );
        }
    );


/* Промт */

elements.promptInput
    .addEventListener(
        "input",
        updateCharactersCount
    );


/* Категория */

elements.addCategoryButton
    .addEventListener(
        "click",
        () => {

            addSelectedCategory(
                elements.categoryInput.value
            );
        }
    );


elements.categoryInput
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                addSelectedCategory(
                    elements.categoryInput.value
                );
            }
        }
    );


elements.categoryInput
    .addEventListener(
        "input",
        renderCategorySuggestions
    );


/* Настройки */

elements.mobileSettingsButton

    .addEventListener(

        "click",

        openSettings

    );


elements.desktopSettingsButton

    .addEventListener(

        "click",

        openSettings

    );


elements.closeSettingsModal

    .addEventListener(

        "click",

        closeSettings

    );

/* Резервная копия */

elements.exportButton
    .addEventListener(
        "click",
        exportLibrary
    );


/* Восстановление */

elements.importInput
    .addEventListener(
        "change",
        event => {

            importLibrary(
                event.target.files[0]
            );
        }
    );


/* Очистка */

elements.clearDatabaseButton
    .addEventListener(
        "click",
        handleClearDatabase
    );


/* =========================================================
   ЗАКРЫТИЕ МОДАЛОК ПО ФОНУ
========================================================= */

elements.viewModal
    .addEventListener(
        "click",
        event => {

            if (
                event.target ===
                elements.viewModal
            ) {

                closeViewModal();
            }
        }
    );


elements.formModal
    .addEventListener(
        "click",
        event => {

            if (
                event.target ===
                elements.formModal
            ) {

                closeFormModal();
            }
        }
    );


elements.settingsModal
    .addEventListener(
        "click",
        event => {

            if (
                event.target ===
                elements.settingsModal
            ) {

                closeSettings();
            }
        }
    );


/* =========================================================
   ESC
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Escape"
        ) {
            return;
        }


        const bulkModal =
            document.getElementById(
                "bulkModal"
            );


        if (
            bulkModal &&
            !bulkModal.classList.contains(
                "hidden"
            )
        ) {

            closeBulkModal();

            return;
        }


        const massModal =
            document.getElementById(
                "massEditModal"
            );


        if (
            massModal &&
            !massModal.classList.contains(
                "hidden"
            )
        ) {

            closeMassModal();

            return;
        }


        if (
            !elements.viewModal
                .classList.contains(
                    "hidden"
                )
        ) {

            closeViewModal();

            return;
        }


        if (
            !elements.formModal
                .classList.contains(
                    "hidden"
                )
        ) {

            closeFormModal();

            return;
        }


        if (
            !elements.settingsModal
                .classList.contains(
                    "hidden"
                )
        ) {

            closeSettings();

            return;
        }


        if (selectionMode) {

            exitSelectionMode();

        }
    }
);

/* =========================================================
   УПРАВЛЕНИЕ КАТЕГОРИЯМИ
========================================================= */

const CUSTOM_CATEGORIES_STORAGE_KEY =
    "oksana-prompts-custom-categories";

const HIDDEN_CATEGORIES_STORAGE_KEY =
    "oksana-prompts-hidden-categories";


function getCustomCategories() {

    try {

        const saved =
            localStorage.getItem(
                CUSTOM_CATEGORIES_STORAGE_KEY
            );

        if (!saved) {
            return [];
        }

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(error);

        return [];
    }
}


function saveCustomCategories(categories) {

    localStorage.setItem(
        CUSTOM_CATEGORIES_STORAGE_KEY,
        JSON.stringify(
            categories
        )
    );
}


function getHiddenCategories() {

    try {

        const saved =
            localStorage.getItem(
                HIDDEN_CATEGORIES_STORAGE_KEY
            );

        if (!saved) {
            return [];
        }

        const parsed =
            JSON.parse(saved);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(error);

        return [];
    }
}


function saveHiddenCategories(categories) {

    localStorage.setItem(
        HIDDEN_CATEGORIES_STORAGE_KEY,
        JSON.stringify(
            categories
        )
    );
}


function addManagedCategory() {

    const input =
        document.getElementById(
            "managedCategoryInput"
        );

    if (!input) {
        return;
    }

    const category =
        input.value
            .trim()
            .replace(
                /\s+/g,
                " "
            );

    if (!category) {

        showToast(
            "Введите название категории",
            "!"
        );

        input.focus();

        return;
    }


    const exists =
        getAllCategories().some(
            item =>
                normalizeText(item) ===
                normalizeText(category)
        );


    if (exists) {

        showToast(
            "Такая категория уже существует",
            "!"
        );

        input.focus();

        return;
    }


    const custom =
        getCustomCategories();

    custom.push(
        category
    );

    custom.sort(
        (a, b) =>
            a.localeCompare(
                b,
                "ru"
            )
    );

    saveCustomCategories(
        custom
    );


    const hidden =
        getHiddenCategories()
            .filter(
                item =>
                    normalizeText(item) !==
                    normalizeText(category)
            );

    saveHiddenCategories(
        hidden
    );


    input.value = "";

    renderCategoryManagement();
    renderCategories();
    renderCategorySuggestions();

    showToast(
        `Категория «${category}» добавлена`,
        "✓"
    );
}


async function renameManagedCategory(
    oldCategory
) {

    const newCategory =
        window.prompt(
            `Новое название категории «${oldCategory}»:`,
            oldCategory
        );


    if (newCategory === null) {
        return;
    }


    const cleanNewCategory =
        newCategory
            .trim()
            .replace(
                /\s+/g,
                " "
            );


    if (!cleanNewCategory) {

        showToast(
            "Название не может быть пустым",
            "!"
        );

        return;
    }


    if (
        normalizeText(
            oldCategory
        ) ===
        normalizeText(
            cleanNewCategory
        )
    ) {
        return;
    }


    const duplicate =
        getAllCategories().some(
            category =>
                normalizeText(
                    category
                ) ===
                normalizeText(
                    cleanNewCategory
                )
        );


    if (duplicate) {

        showToast(
            "Такая категория уже существует",
            "!"
        );

        return;
    }


    try {

        const worksToUpdate =
            works.filter(
                work =>
                    Array.isArray(
                        work.categories
                    ) &&
                    work.categories.some(
                        category =>
                            normalizeText(
                                category
                            ) ===
                            normalizeText(
                                oldCategory
                            )
                    )
            );


        for (
            const work
            of worksToUpdate
        ) {

            work.categories =
                work.categories.map(
                    category =>
                        normalizeText(
                            category
                        ) ===
                        normalizeText(
                            oldCategory
                        )
                            ? cleanNewCategory
                            : category
                );


            work.updatedAt =
                Date.now();


            await saveWorkToDB(
                work
            );
        }


        const custom =
            getCustomCategories();


        const customIndex =
            custom.findIndex(
                category =>
                    normalizeText(
                        category
                    ) ===
                    normalizeText(
                        oldCategory
                    )
            );


        if (customIndex >= 0) {

            custom[
                customIndex
            ] =
                cleanNewCategory;

            saveCustomCategories(
                custom
            );
        }


        const hidden =
            getHiddenCategories();


        const hiddenIndex =
            hidden.findIndex(
                category =>
                    normalizeText(
                        category
                    ) ===
                    normalizeText(
                        oldCategory
                    )
            );


        if (hiddenIndex >= 0) {

            hidden[
                hiddenIndex
            ] =
                cleanNewCategory;

            saveHiddenCategories(
                hidden
            );
        }


        if (
            normalizeText(
                activeCategory
            ) ===
            normalizeText(
                oldCategory
            )
        ) {

            activeCategory =
                cleanNewCategory;
        }


        renderCategoryManagement();
        renderCategories();
        renderCategorySuggestions();
        renderAll();


        showToast(
            `Категория переименована`,
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось переименовать категорию",
            "!"
        );
    }
}


async function deleteManagedCategory(
    category
) {

    const confirmed =
        window.confirm(
            `Удалить категорию «${category}»?\n\nКатегория будет убрана со всех фотографий. Сами фотографии и промты останутся.`
        );


    if (!confirmed) {
        return;
    }


    try {

        const worksToUpdate =
            works.filter(
                work =>
                    Array.isArray(
                        work.categories
                    ) &&
                    work.categories.some(
                        item =>
                            normalizeText(
                                item
                            ) ===
                            normalizeText(
                                category
                            )
                    )
            );


        for (
            const work
            of worksToUpdate
        ) {

            work.categories =
                work.categories.filter(
                    item =>
                        normalizeText(
                            item
                        ) !==
                        normalizeText(
                            category
                        )
                );


            work.updatedAt =
                Date.now();


            await saveWorkToDB(
                work
            );
        }


        const custom =
            getCustomCategories()
                .filter(
                    item =>
                        normalizeText(
                            item
                        ) !==
                        normalizeText(
                            category
                        )
                );


        saveCustomCategories(
            custom
        );


        const hidden =
            getHiddenCategories();


        if (
            !hidden.some(
                item =>
                    normalizeText(
                        item
                    ) ===
                    normalizeText(
                        category
                    )
            )
        ) {

            hidden.push(
                category
            );
        }


        saveHiddenCategories(
            hidden
        );


        if (
            normalizeText(
                activeCategory
            ) ===
            normalizeText(
                category
            )
        ) {

            activeCategory =
                "Все";
        }


        renderCategoryManagement();
        renderCategories();
        renderCategorySuggestions();
        renderAll();


        showToast(
            `Категория «${category}» удалена`,
            "✓"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось удалить категорию",
            "!"
        );
    }
}


function renderCategoryManagement() {

    const container =
        document.getElementById(
            "managedCategoriesList"
        );

    if (!container) {
        return;
    }


    const categories =
        getAllCategories();


    if (!categories.length) {

        container.innerHTML = `
            <div
                style="
                    padding:20px;
                    text-align:center;
                    opacity:.65;
                "
            >
                Категорий пока нет
            </div>
        `;

        return;
    }


    container.innerHTML =
        categories
            .map(
                category => {

                    const count =
                        works.filter(
                            work =>
                                Array.isArray(
                                    work.categories
                                ) &&
                                work.categories.some(
                                    item =>
                                        normalizeText(
                                            item
                                        ) ===
                                        normalizeText(
                                            category
                                        )
                                )
                        ).length;


                    return `
                        <div
                            class="managed-category-row"
                            style="
                                display:flex;
                                align-items:center;
                                gap:10px;
                                padding:10px 0;
                                border-bottom:1px solid rgba(255,255,255,.08);
                            "
                        >

                            <div
                                style="
                                    flex:1;
                                    min-width:0;
                                "
                            >
                                <div
                                    style="
                                        font-weight:600;
                                        color:#fff;
                                        overflow:hidden;
                                        text-overflow:ellipsis;
                                    "
                                >
                                    ${escapeHTML(category)}
                                </div>

                                <div
                                    style="
                                        margin-top:3px;
                                        font-size:12px;
                                        opacity:.55;
                                    "
                                >
                                    Работ: ${count}
                                </div>
                            </div>

                            <button
                                type="button"
                                class="secondary-button"
                                data-rename-category="${escapeHTML(category)}"
                                style="
                                    padding:8px 10px;
                                    min-width:auto;
                                "
                                title="Переименовать"
                            >
                                ✎
                            </button>

                            <button
                                type="button"
                                class="secondary-button"
                                data-delete-category="${escapeHTML(category)}"
                                style="
                                    padding:8px 10px;
                                    min-width:auto;
                                    color:#ff7b9d;
                                "
                                title="Удалить"
                            >
                                🗑
                            </button>

                        </div>
                    `;
                }
            )
            .join("");


    container
        .querySelectorAll(
            "[data-rename-category]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        renameManagedCategory(
                            button.dataset
                                .renameCategory
                        );
                    }
                );
            }
        );


    container
        .querySelectorAll(
            "[data-delete-category]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteManagedCategory(
                            button.dataset
                                .deleteCategory
                        );
                    }
                );
            }
        );
}


function createCategoryManagementModal() {

    if (
        document.getElementById(
            "categoryManagementModal"
        )
    ) {
        return;
    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "categoryManagementModal";


    modal.className =
        "modal-overlay hidden";


    modal.innerHTML = `
        <div
            class="modal form-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="categoryManagementTitle"
            style="max-width:620px;"
        >

            <button
                type="button"
                class="modal-close"
                id="closeCategoryManagementModal"
                aria-label="Закрыть"
            >
                ×
            </button>


            <div class="modal-header">

                <div class="modal-kicker">
                    КАТЕГОРИИ
                </div>

                <h2 id="categoryManagementTitle">
                    Управление категориями
                </h2>

                <p>
                    Создавай, переименовывай и удаляй категории.
                </p>

            </div>


            <div
                style="
                    display:flex;
                    gap:8px;
                    margin-bottom:20px;
                "
            >

                <input
                    type="text"
                    id="managedCategoryInput"
                    placeholder="Новая категория..."
                    autocomplete="off"
                    style="flex:1;"
                >

                <button
                    type="button"
                    class="primary-button"
                    id="addManagedCategoryButton"
                >
                    ＋ Добавить
                </button>

            </div>


            <div
                id="managedCategoriesList"
                style="
                    max-height:420px;
                    overflow:auto;
                "
            >
            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    const closeButton =
        document.getElementById(
            "closeCategoryManagementModal"
        );


    const addButton =
        document.getElementById(
            "addManagedCategoryButton"
        );


    const input =
        document.getElementById(
            "managedCategoryInput"
        );


    closeButton.addEventListener(
        "click",
        closeCategoryManagementModal
    );


    addButton.addEventListener(
        "click",
        addManagedCategory
    );


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                addManagedCategory();
            }
        }
    );


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                modal
            ) {

                closeCategoryManagementModal();
            }
        }
    );
}


function openCategoryManagementModal() {

    createCategoryManagementModal();

    renderCategoryManagement();


    const modal =
        document.getElementById(
            "categoryManagementModal"
        );


    modal.classList.remove(
        "hidden"
    );


    document.body.style.overflow =
        "hidden";
}


function closeCategoryManagementModal() {

    const modal =
        document.getElementById(
            "categoryManagementModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    document.body.style.overflow =
        "";
}

function addCategoryManagementButton() {

    if (
        document.getElementById(
            "openCategoryManagementButton"
        )
    ) {
        return;
    }

    const massToolbar =
        document.getElementById(
            "massActionsToolbar"
        );

    if (!massToolbar) {
        console.error(
            "Не найден massActionsToolbar"
        );
        return;
    }

    const button =
        document.createElement(
            "button"
        );

    button.type =
        "button";

    button.id =
        "openCategoryManagementButton";

    button.className =
        "secondary-button";

    button.innerHTML =
        "🏷 Управление категориями";

    button.style.cssText = `
        margin:14px 0 18px 0;
        padding:11px 16px;
        white-space:nowrap;
        cursor:pointer;
    `;

    button.addEventListener(
        "click",
        openCategoryManagementModal
    );

    /*
       Ставим кнопку НЕ внутрь массового управления,
       а сразу после него.
    */

    massToolbar.insertAdjacentElement(
        "afterend",
        button
    );
}

/* =========================================================
   КНОПКА СТАТИСТИКИ
========================================================= */

function addStatisticsButton() {

    if (
        document.getElementById(
            "openStatisticsButton"
        )
    ) {
        return;
    }


    const massToolbar =
        document.getElementById(
            "massActionsToolbar"
        );


    if (!massToolbar) {

        console.error(
            "Не найден massActionsToolbar"
        );

        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.type =
        "button";


    button.id =
        "openStatisticsButton";


    button.className =
        "secondary-button";


    button.innerHTML =
        "📊 Статистика";


    button.style.cssText = `
        margin:0 0 18px 10px;
        padding:11px 16px;
        white-space:nowrap;
        cursor:pointer;
    `;


    button.addEventListener(
        "click",
        openStatisticsModal
    );


    const categoryButton =
        document.getElementById(
            "openCategoryManagementButton"
        );


    if (categoryButton) {

        categoryButton.insertAdjacentElement(
            "afterend",
            button
        );

    } else {

        massToolbar.insertAdjacentElement(
            "afterend",
            button
        );
    }
}

/* =========================================================
   СТАТИСТИКА БИБЛИОТЕКИ
========================================================= */

function createStatisticsModal() {

    if (
        document.getElementById(
            "statisticsModal"
        )
    ) {
        return;
    }


    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "statisticsModal";

    modal.className =
        "modal-overlay hidden";


    modal.innerHTML = `

        <div
            class="modal form-modal statistics-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="statisticsTitle"
        >

            <button
                type="button"
                class="modal-close"
                id="closeStatisticsModal"
                aria-label="Закрыть"
            >
                ×
            </button>


            <div class="modal-header">

                <div class="modal-kicker">
                    БИБЛИОТЕКА
                </div>

                <h2 id="statisticsTitle">
                    Статистика
                </h2>

                <p>
                    Краткая информация о твоей коллекции НейроФото.
                </p>

            </div>


            <div
                id="statisticsContent"
                class="statistics-content"
            >
            </div>

        </div>
    `;


    document.body.appendChild(
        modal
    );


    const closeButton =
        document.getElementById(
            "closeStatisticsModal"
        );


    closeButton.addEventListener(
        "click",
        closeStatisticsModal
    );


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                modal
            ) {

                closeStatisticsModal();
            }
        }
    );
}


/* =========================================================
   ФОРМИРОВАНИЕ СТАТИСТИКИ
========================================================= */

function getLibraryStatistics() {

    const total =
        works.length;


    const favorites =
        works.filter(
            work =>
                work.favorite ===
                true
        ).length;


    const withPrompt =
        works.filter(
            work =>
                work.prompt &&
                String(
                    work.prompt
                ).trim()
        ).length;


    const withoutPrompt =
        total -
        withPrompt;


    /* =====================================================
       КАТЕГОРИИ
    ===================================================== */

    const categoryCounts =
        {};


    works.forEach(
        work => {

            const categories =
                Array.isArray(
                    work.categories
                )
                    ? work.categories
                    : [];


            categories.forEach(
                category => {

                    const clean =
                        String(
                            category
                        ).trim();


                    if (!clean) {
                        return;
                    }


                    categoryCounts[
                        clean
                    ] =
                        (
                            categoryCounts[
                                clean
                            ] || 0
                        ) + 1;
                }
            );
        }
    );


    const sortedCategories =
        Object.entries(
            categoryCounts
        )
            .sort(
                (
                    a,
                    b
                ) =>
                    b[1] -
                    a[1]
            );


    /* =====================================================
       ДАТЫ
    ===================================================== */

    const dates =
        works
            .map(
                work =>
                    work.createdAt
            )
            .filter(
                value =>
                    typeof value ===
                    "number"
            );


    let oldestDate =
        null;

    let newestDate =
        null;


    if (dates.length) {

        oldestDate =
            new Date(
                Math.min(
                    ...dates
                )
            );

        newestDate =
            new Date(
                Math.max(
                    ...dates
                )
            );
    }


    /* =====================================================
       ДИНАМИКА 7 / 30 ДНЕЙ
    ===================================================== */

    const now =
        Date.now();


    const sevenDaysAgo =
        now -
        (
            7 *
            24 *
            60 *
            60 *
            1000
        );


    const thirtyDaysAgo =
        now -
        (
            30 *
            24 *
            60 *
            60 *
            1000
        );


    const last7Days =
        works.filter(
            work =>
                typeof work.createdAt ===
                    "number" &&
                work.createdAt >=
                    sevenDaysAgo
        ).length;


    const last30Days =
        works.filter(
            work =>
                typeof work.createdAt ===
                    "number" &&
                work.createdAt >=
                    thirtyDaysAgo
        ).length;


    /* =====================================================
       САМАЯ ПОПУЛЯРНАЯ КАТЕГОРИЯ
    ===================================================== */

    let topCategory =
        null;


    if (
        sortedCategories.length
    ) {

        topCategory =
            sortedCategories[0];
    }


    /* =====================================================
       РАБОТЫ ПО МЕСЯЦАМ
    ===================================================== */

    const monthCounts =
        {};


    works.forEach(
        work => {

            if (
                typeof work.createdAt !==
                "number"
            ) {
                return;
            }


            const date =
                new Date(
                    work.createdAt
                );


            const key =
                `${date.getFullYear()}-${String(
                    date.getMonth() + 1
                ).padStart(
                    2,
                    "0"
                )}`;


            monthCounts[key] =
                (
                    monthCounts[key] ||
                    0
                ) + 1;
        }
    );


    const monthlyStats =
        Object.entries(
            monthCounts
        )
            .sort(
                (
                    a,
                    b
                ) =>
                    a[0].localeCompare(
                        b[0]
                    )
            )
            .slice(-6);


    return {

        total,

        favorites,

        withPrompt,

        withoutPrompt,

        categories:
            sortedCategories,

        oldestDate,

        newestDate,

        last7Days,

        last30Days,

        topCategory,

        monthlyStats
    };
}

/* =========================================================
   ОТРИСОВКА СТАТИСТИКИ
========================================================= */

function renderStatistics() {

    const container =
        document.getElementById(
            "statisticsContent"
        );


    if (!container) {
        return;
    }


    const statistics =
        getLibraryStatistics();


    const formatDate =
        date => {

            if (!date) {
                return "—";
            }

            return date.toLocaleDateString(
                "ru-RU",
                {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                }
            );
        };


    const categoriesHTML =
        statistics.categories.length

            ? statistics.categories
                .map(
                    (
                        [
                            category,
                            count
                        ]
                    ) => `

                        <div
                            class="statistics-category-row"
                        >

                            <span>
                                ${escapeHTML(
                                    category
                                )}
                            </span>

                            <strong>
                                ${count}
                            </strong>

                        </div>

                    `
                )
                .join("")

            : `

                <div
                    class="statistics-empty"
                >
                    Категории пока не используются
                </div>

            `;


    container.innerHTML = `

        <div
            class="statistics-cards"
        >

            <div
                class="statistics-card"
            >
                <div
                    class="statistics-card-icon"
                >
                    📸
                </div>

                <div
                    class="statistics-card-value"
                >
                    ${statistics.total}
                </div>

                <div
                    class="statistics-card-label"
                >
                    Всего работ
                </div>
            </div>


            <div
                class="statistics-card"
            >
                <div
                    class="statistics-card-icon"
                >
                    ⭐
                </div>

                <div
                    class="statistics-card-value"
                >
                    ${statistics.favorites}
                </div>

                <div
                    class="statistics-card-label"
                >
                    В избранном
                </div>
            </div>


            <div
                class="statistics-card"
            >
                <div
                    class="statistics-card-icon"
                >
                    📝
                </div>

                <div
                    class="statistics-card-value"
                >
                    ${statistics.withPrompt}
                </div>

                <div
                    class="statistics-card-label"
                >
                    С промтом
                </div>
            </div>


            <div
                class="statistics-card"
            >
                <div
                    class="statistics-card-icon"
                >
                    🗂
                </div>

                <div
                    class="statistics-card-value"
                >
                    ${statistics.categories.length}
                </div>

                <div
                    class="statistics-card-label"
                >
                    Категорий
                </div>
            </div>
        <div
            class="statistics-cards"
        >

            <div
                class="statistics-card"
            >
                <div
                    class="statistics-card-icon"
                >
                    ⚡
                </div>

                <div
                    class="statistics-card-value"
                >
                    ${statistics.last7Days}
                </div>

                <div
                    class="statistics-card-label"
                >
                    За последние 7 дней
                </div>
            </div>


            <div
                class="statistics-card"
            >
                <div
                    class="statistics-card-icon"
                >
                    📈
                </div>

                <div
                    class="statistics-card-value"
                >
                    ${statistics.last30Days}
                </div>

                <div
                    class="statistics-card-label"
                >
                    За последние 30 дней
                </div>
            </div>


            <div
                class="statistics-card"
                style="grid-column:1 / -1;"
            >
                <div
                    class="statistics-card-icon"
                >
                    🏆
                </div>

                <div
                    class="statistics-card-value"
                    style="font-size:22px;"
                >
                    ${
                        statistics.topCategory
                            ? escapeHTML(
                                statistics.topCategory[0]
                            )
                            : "—"
                    }
                </div>

                <div
                    class="statistics-card-label"
                >
                    Самая используемая категория:
                    ${
                        statistics.topCategory
                            ? statistics.topCategory[1]
                            : 0
                    }
                    работ
                </div>
            </div>

        </div>
        </div>


        <div
            class="statistics-section"
        >
        <div
            class="statistics-section"
        >

            <div
                class="statistics-section-title"
            >
                📈 Новые работы по месяцам
            </div>


            <div
                class="statistics-months"
            >

                ${
                    statistics.monthlyStats.length
                        ? statistics.monthlyStats
                            .map(
                                (
                                    [
                                        month,
                                        count
                                    ]
                                ) => {

                                    const max =
                                        Math.max(
                                            ...statistics
                                                .monthlyStats
                                                .map(
                                                    item =>
                                                        item[1]
                                                )
                                        );


                                    const percent =
                                        max
                                            ? Math.max(
                                                8,
                                                (
                                                    count /
                                                    max
                                                ) *
                                                100
                                            )
                                            : 0;


                                    const [
                                        year,
                                        monthNumber
                                    ] =
                                        month.split(
                                            "-"
                                        );


                                    const date =
                                        new Date(
                                            Number(
                                                year
                                            ),
                                            Number(
                                                monthNumber
                                            ) - 1,
                                            1
                                        );


                                    const label =
                                        date.toLocaleDateString(
                                            "ru-RU",
                                            {
                                                month:
                                                    "short"
                                            }
                                        );


                                    return `

                                        <div
                                            class="statistics-month"
                                        >

                                            <div
                                                class="statistics-month-count"
                                            >
                                                ${count}
                                            </div>

                                            <div
                                                class="statistics-bar-wrapper"
                                            >
                                                <div
                                                    class="statistics-bar"
                                                    style="height:${percent}%"
                                                ></div>
                                            </div>

                                            <div
                                                class="statistics-month-label"
                                            >
                                                ${label}
                                                ${year}
                                            </div>

                                        </div>

                                    `;
                                }
                            )
                            .join("")

                        : `

                            <div
                                class="statistics-empty"
                            >
                                Пока недостаточно данных
                            </div>

                        `
                }

            </div>

        </div>
            <div
                class="statistics-section-title"
            >
                📊 Работы по категориям
            </div>


            <div
                class="statistics-category-list"
            >
                ${categoriesHTML}
            </div>

        </div>


        <div
            class="statistics-section"
        >

            <div
                class="statistics-section-title"
            >
                📅 Период библиотеки
            </div>


            <div
                class="statistics-dates"
            >

                <div>
                    <span>
                        Первая работа
                    </span>

                    <strong>
                        ${formatDate(
                            statistics.oldestDate
                        )}
                    </strong>
                </div>


                <div>
                    <span>
                        Последняя работа
                    </span>

                    <strong>
                        ${formatDate(
                            statistics.newestDate
                        )}
                    </strong>
                </div>

            </div>

        </div>


        ${
            statistics.withoutPrompt > 0
                ? `

                    <div
                        class="statistics-warning"
                    >
                        ⚠️ Работ без промта:
                        <strong>
                            ${statistics.withoutPrompt}
                        </strong>
                    </div>

                `
                : `

                    <div
                        class="statistics-success"
                    >
                        ✓ У всех работ есть промт
                    </div>

                `
        }

    `;
}


/* =========================================================
   ОТКРЫТИЕ / ЗАКРЫТИЕ
========================================================= */

function openStatisticsModal() {

    createStatisticsModal();

    renderStatistics();


    const modal =
        document.getElementById(
            "statisticsModal"
        );


    modal.classList.remove(
        "hidden"
    );


    document.body.style.overflow =
        "hidden";
}


function closeStatisticsModal() {

    const modal =
        document.getElementById(
            "statisticsModal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );


    document.body.style.overflow =
        "";
}

/* =========================================================
   ПАНЕЛЬ УМНЫХ ФИЛЬТРОВ
========================================================= */

function createSmartFilters() {

    if (
        document.getElementById(
            "smartFilters"
        )
    ) {
        return;
    }


    const categories =
        elements.categories;


    if (!categories) {
        return;
    }


    const container =
        document.createElement(
            "div"
        );


    container.id =
        "smartFilters";


    container.className =
        "smart-filters";


    container.innerHTML = `

        <button
            type="button"
            class="smart-filter-button active"
            data-smart-filter="all"
        >
            ✨ Все
        </button>


        <button
            type="button"
            class="smart-filter-button"
            data-smart-filter="pinned"
        >
            📌 Закреплённые
        </button>


        <button
            type="button"
            class="smart-filter-button"
            data-smart-filter="favorites"
        >
            ⭐ Избранные
        </button>


        <button
            type="button"
            class="smart-filter-button"
            data-smart-filter="without-prompt"
        >
            📝 Без промта
        </button>


        <button
            type="button"
            class="smart-filter-button"
            data-smart-filter="without-category"
        >
            🏷 Без категории
        </button>

    `;


    categories.insertAdjacentElement(
        "beforebegin",
        container
    );


    container
        .querySelectorAll(
            "[data-smart-filter]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        activeSmartFilter =
                            button.dataset
                                .smartFilter;


                        container
                            .querySelectorAll(
                                "[data-smart-filter]"
                            )
                            .forEach(
                                item => {

                                    item.classList.toggle(
                                        "active",
                                        item ===
                                            button
                                    );
                                }
                            );


                        /*
                           Если включён умный фильтр,
                           убираем режим «Избранное»
                           из старой навигации.
                        */

                        showFavoritesOnly =
                            false;


                        activeCategory =
                            "Все";


                        updateMobileNavigation();

                        renderAll();
                    }
                );
            }
        );
}
/* =========================================================
   ЗАПУСК
========================================================= */

async function init() {

    try {

        if (
            !("indexedDB" in window)
        ) {

            throw new Error(
                "Этот браузер не поддерживает IndexedDB"
            );
        }


        /*
           Сначала создаём интерфейс массового
           управления и управления категориями,
           чтобы renderAll() уже знал о них.
        */

        createMassActionsToolbar();

        createMassModal();

        createCategoryManagementModal();


        await openDatabase();

        await loadWorks();

        updateMobileNavigation();

        addBulkUploadButton();

        addCategoryManagementButton();

        addStatisticsButton();

        createSmartFilters();


        console.log(
            "Оксана — промты: приложение запущено"
        );

    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось запустить библиотеку",
            "!"
        );
    }
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    init
);