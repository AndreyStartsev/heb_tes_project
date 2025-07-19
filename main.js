document.addEventListener('DOMContentLoaded', () => {
    initLobby();
});

// --- Cookie Helper Functions ---
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function getAllQuizResults() {
    const results = {};
    const cookies = document.cookie.split(';');
    cookies.forEach(cookie => {
        const parts = cookie.trim().split('=');
        const name = parts[0];
        if (name.startsWith('quiz_result_')) {
            const quizId = name.replace('quiz_result_', '');
            results[quizId] = JSON.parse(parts[1]);
        }
    });
    return results;
}

// --- Main Lobby Logic ---
async function initLobby() {
    try {
        // === ИЗМЕНЕНИЕ ЗДЕСЬ ===
        // Добавлена опция { cache: 'no-store' } для борьбы с кэшированием
        const response = await fetch('quizzes/manifest.json', { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const quizManifest = await response.json();
        const allResults = getAllQuizResults();

        displayQuizList(quizManifest, allResults);
        displayResultsSummary(allResults);

    } catch (error) {
        console.error("Failed to initialize lobby:", error);
        document.getElementById('quiz-list-container').innerHTML = '<p>שגיאה בטעינת רשימת המבחנים.</p>';
    }
}

function displayQuizList(manifest, results) {
    const listContainer = document.getElementById('quiz-list-container');
    
    const todayStr = new Date().toISOString().slice(0, 10);
    const quizTakenToday = Object.values(results).some(res => res.endDate.startsWith(todayStr));

    if (manifest.length === 0) {
        listContainer.innerHTML = '<p>אין מבחנים זמינים כרגע.</p>';
        return;
    }
    
    let html = '<ul>';
    manifest.forEach(quiz => {
        const result = results[quiz.id];
        
        html += '<li>';
        if (result) {
            // Тест пройден
            html += `<span class="completed">${quiz.title} (הושלם)</span>`;
        } else if (quizTakenToday) {
            // Тест доступен, но сегодня уже был пройден другой
            html += `<span class="locked">${quiz.title} (ניתן להשלים רק מבחן אחד ביום)</span>`;
        } else {
            // Тест доступен для прохождения
            html += `<a href="quiz.html?id=${quiz.id}" class="active">${quiz.title}</a>`;
        }
        html += '</li>';
    });
    html += '</ul>';

    if (quizTakenToday) {
        html += '<p class="notice">השלמת את המבחן היומי שלך. נסה שוב מחר!</p>';
    }
    
    listContainer.innerHTML = html;
}

function displayResultsSummary(results) {
    const summaryContainer = document.getElementById('results-summary-container');
    const completedQuizzes = Object.keys(results);

    if (completedQuizzes.length === 0) {
        summaryContainer.innerHTML = '<p>עדיין לא השלמת אף מבחן.</p>';
        return;
    }

    let html = '<ul>';
    for (const quizId in results) {
        const result = results[quizId];
        const startDate = new Date(result.startDate).toLocaleDateString('he-IL');
        const endDate = new Date(result.endDate).toLocaleDateString('he-IL');
        
        html += `<li><strong>מבחן: ${quizId}</strong> - 
                 <strong>ציון:</strong> ${result.score}, 
                 <strong>התחלה:</strong> ${startDate}, 
                 <strong>סיום:</strong> ${endDate}</li>`;
    }
    html += '</ul>';
    summaryContainer.innerHTML = html;
}