// --- Глобальные переменные ---
const pointsPerQuestion = 6;
const secretWordThreshold = 100;
const maxAttemptsPerCycle = 3;

let correctlyAnsweredInSession = {};
let currentAttemptInCycle = 0;
let quizData = {};
let quizId = null;
let quizStartTime = null;

// --- Функции для работы с Cookie ---
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

// --- Инициализация и построение интерфейса ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    quizId = urlParams.get('id');

    if (!quizId) {
        document.body.innerHTML = '<h1>שגיאה: לא נבחר מבחן. <a href="index.html">חזור לרשימה</a></h1>';
        return;
    }

    if (getCookie(`quiz_result_${quizId}`)) {
        document.body.innerHTML = `<h1>כבר השלמת את המבחן הזה. <a href="index.html">חזור לרשימה</a></h1>`;
        return;
    }
    
    quizStartTime = new Date();
    loadQuiz(`quizzes/${quizId}.json`);
});

async function loadQuiz(jsonPath) {
    try {
        const response = await fetch(jsonPath);
        if (!response.ok) { throw new Error(`HTTP error: ${response.status}`); }
        quizData = await response.json();
        buildQuizUI();
        resetFullQuiz();
    } catch (error) {
        document.getElementById('quiz-title').textContent = 'שגיאה בטעינת המבחן';
        console.error("Could not load quiz data:", error);
    }
}

function buildQuizUI() {
    document.getElementById('quiz-title').textContent = quizData.quizTitle;
    document.getElementById('quiz-intro').innerHTML = quizData.quizIntro;
    const formContainer = document.getElementById('quiz-form');
    let html = '';
    quizData.questions.forEach(block => {
        html += `<div class="text-block"><h2>${block.blockTitle}</h2>`;
        block.items.forEach(item => {
            html += `<div class="question">`;
            if (item.hebrewContext) html += `<div class="hebrew-text">${item.hebrewContext}</div>`;
            if (item.vocabulary && item.vocabulary.length > 0) {
                html += `<div class="vocabulary"><details><summary>מילון:</summary><ul>`;
                item.vocabulary.forEach(v => { html += `<li>${v.term} - ${v.definition}</li>`; });
                html += `</ul></details></div>`;
            }
            html += `<p>${item.questionText}</p><div class="options">`;
            for (const key in item.options) {
                html += `<label><input type="radio" name="${item.id}" value="${key}"><span> ${item.options[key]}</span></label>`;
            }
            html += `</div><div class="feedback" id="feedback-${item.id}"></div></div>`;
        });
        html += `</div>`;
    });
    formContainer.innerHTML = html;
}

function findQuestionData(questionId) {
    for (const block of quizData.questions) {
        const foundItem = block.items.find(item => item.id === questionId);
        if (foundItem) return foundItem;
    }
    return null;
}

// --- Логика теста ---
function updateAttemptCounterDisplay() {
    const attemptDisplay = document.getElementById('attempt-counter-display');
    if (currentAttemptInCycle <= maxAttemptsPerCycle) {
         attemptDisplay.textContent = `ניסיון בדיקה: ${currentAttemptInCycle} מתוך ${maxAttemptsPerCycle}`;
         if(currentAttemptInCycle === 0) attemptDisplay.textContent = `לחצו "בדיקת תשובות" להתחיל. ${maxAttemptsPerCycle} ניסיונות בסך הכל.`;
    } else {
        attemptDisplay.textContent = `הניסיונות אזלו.`;
    }
}

function submitQuiz() {
    if (Object.keys(quizData).length === 0) return;

    currentAttemptInCycle++;
    updateAttemptCounterDisplay();

    let currentTotalScore = 0;
    const form = document.getElementById('quiz-form');
    
    quizData.questions.forEach(block => {
        block.items.forEach(item => {
            const feedbackEl = document.getElementById(`feedback-${item.id}`);
            if (feedbackEl && !correctlyAnsweredInSession[item.id]) {
                feedbackEl.textContent = '';
                feedbackEl.className = 'feedback';
            }
            
            if (correctlyAnsweredInSession[item.id]) {
                currentTotalScore += pointsPerQuestion;
                return;
            }

            const userAnswer = form.elements[item.id] ? form.elements[item.id].value : "";

            if (userAnswer && userAnswer === item.correctAnswer) {
                currentTotalScore += pointsPerQuestion;
                correctlyAnsweredInSession[item.id] = true;
                feedbackEl.textContent = 'נכון!';
                feedbackEl.className = 'feedback correct';
            } else if (userAnswer) {
                feedbackEl.textContent = 'לא נכון.';
                feedbackEl.className = 'feedback incorrect';
            } else {
                feedbackEl.textContent = 'אין תשובה.';
                feedbackEl.className = 'feedback unanswered';
            }
        });
    });

    const resultsContainer = document.getElementById('results-container');
    resultsContainer.style.display = 'block';
    document.getElementById('score-display').textContent = `צברת ${currentTotalScore} מתוך ${quizData.questions.flatMap(b => b.items).length * pointsPerQuestion} נקודות.`;
    
    if (currentTotalScore > secretWordThreshold) {
        handleSuccess(currentTotalScore);
    } else {
        if (currentAttemptInCycle < maxAttemptsPerCycle) {
            handleRetry(currentTotalScore);
        } else {
            handleFailureNoMoreAttempts(currentTotalScore);
        }
    }
}

function handleSuccess(score) {
    document.getElementById('score-display').innerHTML += `<br><strong class="secret-word">כל הכבוד! מילת הקסם שלך היא: ${quizData.secretWord}</strong>`;
    showFinalReport(true);
    saveResultsAndRedirect(score);
}

function handleRetry(score) {
    document.getElementById('score-display').innerHTML += `<br><span style="color:red;">נסה/י לשפר את התוצאה! נותרו לך ${maxAttemptsPerCycle - currentAttemptInCycle} ניסיונות.</span>`;
    showCurrentAttemptReport();
    document.querySelector('.submit-button').textContent = `בדיקה (ניסיון ${currentAttemptInCycle + 1})`;
    document.querySelector('.reset-button').style.display = 'block';
}

function handleFailureNoMoreAttempts(score) {
    document.getElementById('score-display').innerHTML += `<br><strong style="color:red;">לצערנו, לא צברת מספיק נקודות לאחר ${maxAttemptsPerCycle} ניסיונות.</strong>`;
    showFinalReport(false);
    saveResultsAndRedirect(score);
}

function showFinalReport(isSuccess) {
    const detailedAnswersDiv = document.getElementById('detailed-answers');
    let reportHtml = `<h3>פירוט תשובות (${isSuccess ? 'הצלחה!' : 'כישלון'}):</h3><ol>`;
    quizData.questions.forEach(block => {
        block.items.forEach(item => {
            const userAnswer = document.forms['quiz-form'].elements[item.id].value;
            reportHtml += `<li>שאלה: ${item.questionText}<br>`;
            if (correctlyAnsweredInSession[item.id]) {
                reportHtml += `<span class="correct">נכון.</span> התשובה היא: "${item.options[item.correctAnswer]}"`;
            } else {
                reportHtml += `<span class="incorrect">לא נכון.</span> `;
                if(userAnswer) reportHtml += `תשובתך הייתה: "${item.options[userAnswer]}". `;
                reportHtml += `התשובה הנכונה היא: "${item.options[item.correctAnswer]}".`;
            }
            if(item.explanation) reportHtml += ` ${item.explanation}`;
            reportHtml += `</li>`;
        });
    });
    reportHtml += '</ol>';
    detailedAnswersDiv.innerHTML = reportHtml;
}

function showCurrentAttemptReport() {
    const detailedAnswersDiv = document.getElementById('detailed-answers');
    let reportHtml = '<h3>תוצאות הניסיון הנוכחי:</h3><ol>';
    quizData.questions.forEach(block => {
        block.items.forEach(item => {
            const radioGroup = document.forms['quiz-form'].elements[item.id];
            reportHtml += `<li>שאלה: ${item.questionText}<br>`;
            if (correctlyAnsweredInSession[item.id]) {
                reportHtml += `<span class="correct">נכון.</span>`;
                for (const radio of radioGroup) {
                    radio.disabled = true;
                    if (radio.value === item.correctAnswer) radio.checked = true;
                }
            } else {
                const userAnswer = radioGroup.value;
                if (userAnswer) reportHtml += `<span class="incorrect">לא נכון.</span>`;
                else reportHtml += `<span class="unanswered">אין תשובה.</span>`;
                for (const radio of radioGroup) { radio.checked = false; }
            }
            reportHtml += `</li>`;
        });
    });
    reportHtml += '</ol>';
    detailedAnswersDiv.innerHTML = reportHtml;
}

function saveResultsAndRedirect(finalScore) {
    const resultData = {
        score: finalScore,
        startDate: quizStartTime.toISOString(),
        endDate: new Date().toISOString(),
        status: 'completed'
    };
    setCookie(`quiz_result_${quizId}`, JSON.stringify(resultData), 365);
    
    document.querySelector('.submit-button').style.display = 'none';
    document.querySelector('.reset-button').style.display = 'none';

    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML += '<p style="font-weight:bold; margin-top:20px;">העמוד יחזור לרשימת המבחנים בעוד מספר שניות...</p>';

    setTimeout(() => { window.location.href = 'index.html'; }, 5000);
}

function resetFullQuiz() {
    correctlyAnsweredInSession = {};
    currentAttemptInCycle = 0;
    updateAttemptCounterDisplay();
    document.getElementById('quiz-form').reset();
    document.querySelectorAll('#quiz-form input[type="radio"]').forEach(radio => radio.disabled = false);
    document.querySelectorAll('.feedback').forEach(el => { el.textContent = ''; el.className = 'feedback'; });
    document.getElementById('results-container').style.display = 'none';
    const submitBtn = document.querySelector('.submit-button');
    submitBtn.textContent = "בדיקת תשובות";
    submitBtn.style.display = 'block';
    document.querySelector('.reset-button').style.display = 'none';
}