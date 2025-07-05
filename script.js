// Глобальные переменные состояния
const pointsPerQuestion = 6;
const secretWordThreshold = 100;
const maxAttemptsPerCycle = 3;

let correctlyAnsweredInSession = {};
let currentAttemptInCycle = 0;
let quizData = {}; // Здесь будут храниться данные загруженного теста

// ===============================================================
// 1. ЗАГРУЗКА И ПОСТРОЕНИЕ ИНТЕРФЕЙСА
// ===============================================================

document.addEventListener('DOMContentLoaded', () => {
    loadQuiz('quizzes/quiz1.json');
});

async function loadQuiz(jsonPath) {
    try {
        const response = await fetch(jsonPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        quizData = await response.json();
        buildQuizUI(quizData);
        resetFullQuiz();
    } catch (error) {
        console.error("Could not load quiz data:", error);
        document.getElementById('quiz-title').textContent = 'שגיאה בטעינת המבחן';
    }
}

function buildQuizUI(data) {
    document.getElementById('quiz-title').textContent = data.quizTitle;
    document.getElementById('quiz-intro').innerHTML = data.quizIntro;

    const formContainer = document.getElementById('quiz-form');
    let html = '';

    data.questions.forEach(block => {
        html += `<div class="text-block">`;
        if (block.blockTitle) {
             html += `<h2>${block.blockTitle}</h2>`;
        }
        
        block.items.forEach(item => {
            html += `<div class="question">`;

            if (item.hebrewContext) {
                html += `<div class="hebrew-text">${item.hebrewContext}</div>`;
            }
            if (item.vocabulary && item.vocabulary.length > 0) {
                html += `<div class="vocabulary"><details><summary>מילון:</summary><ul>`;
                item.vocabulary.forEach(vocabItem => {
                    html += `<li>${vocabItem.term} - ${vocabItem.definition}</li>`;
                });
                html += `</ul></details></div>`;
            }

            html += `<p>${item.questionText}</p>`;
            
            html += `<div class="options">`;
            // Варианты ответов добавляются как A, B, C, D
            const optionKeys = Object.keys(item.options);
            for (const key of optionKeys) {
                 html += `<label><input type="radio" name="${item.id}" value="${key}"><span> ${item.options[key]}</span></label>`;
            }
            html += `</div>`;
            html += `<div class="feedback" id="feedback-${item.id}"></div>`;
            html += `</div>`;
        });

        html += `</div>`;
    });

    formContainer.innerHTML = html;
}

// Хелпер-функция для поиска данных вопроса по его ID
function findQuestionData(questionId) {
    for (const block of quizData.questions) {
        const foundItem = block.items.find(item => item.id === questionId);
        if (foundItem) return foundItem;
    }
    return null;
}

// ===============================================================
// 2. ЛОГИКА ТЕСТА (ПРОВЕРКА, СБРОС, ПОПЫТКИ)
// ===============================================================

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

    if(currentAttemptInCycle === 0) currentAttemptInCycle = 1;
    else if (currentAttemptInCycle < maxAttemptsPerCycle) currentAttemptInCycle++;
    else if (currentAttemptInCycle >= maxAttemptsPerCycle) {
        handleFailureNoMoreAttempts();
        return;
    }
    
    updateAttemptCounterDisplay();

    let currentTotalScore = 0;
    const form = document.getElementById('quiz-form');
    const resultsContainer = document.getElementById('results-container');
    const scoreDisplay = document.getElementById('score-display');
    const detailedAnswersDiv = document.getElementById('detailed-answers');
    
    // Очистка фидбека для нерешенных вопросов
    quizData.questions.forEach(block => {
        block.items.forEach(item => {
            const feedbackEl = document.getElementById(`feedback-${item.id}`);
            if (feedbackEl && !correctlyAnsweredInSession[item.id]) {
                feedbackEl.textContent = '';
                feedbackEl.className = 'feedback';
            }
        });
    });

    // Подсчет очков и фидбек
    quizData.questions.forEach(block => {
        block.items.forEach(item => {
            const questionName = item.id;
            const feedbackEl = document.getElementById(`feedback-${questionName}`);
            
            if (correctlyAnsweredInSession[questionName]) {
                currentTotalScore += pointsPerQuestion;
                return; 
            }

            const userAnswer = form.elements[questionName] ? form.elements[questionName].value : "";

            if (userAnswer) {
                if (userAnswer === item.correctAnswer) {
                    currentTotalScore += pointsPerQuestion;
                    correctlyAnsweredInSession[questionName] = true;
                    feedbackEl.textContent = 'נכון!';
                    feedbackEl.className = 'feedback correct';
                } else {
                    feedbackEl.textContent = 'לא נכון.';
                    feedbackEl.className = 'feedback incorrect';
                }
            } else {
                feedbackEl.textContent = 'אין תשובה.';
                feedbackEl.className = 'feedback unanswered';
            }
        });
    });

    scoreDisplay.textContent = `צברת ${currentTotalScore} מתוך ${quizData.questions.flatMap(b => b.items).length * pointsPerQuestion} נקודות.`;
    resultsContainer.style.display = 'block';
    
    if (currentTotalScore > secretWordThreshold) {
        handleSuccess(currentTotalScore);
    } else {
        if (currentAttemptInCycle < maxAttemptsPerCycle) {
            handleRetry(currentTotalScore);
        } else { 
            handleFailureNoMoreAttempts();
        }
    }
}

function handleSuccess(score) {
    const scoreDisplay = document.getElementById('score-display');
    const detailedAnswersDiv = document.getElementById('detailed-answers');
    const submitButton = document.querySelector('.submit-button');
    const resetButton = document.querySelector('.reset-button');
    
    scoreDisplay.innerHTML = `צברת ${score} נקודות. <br><strong class="secret-word">כל הכבוד! מילת הקסם שלך היא: ${quizData.secretWord}</strong>`;
    
    let reportHtml = '<h3>פירוט תשובות (הצלחה!):</h3><ol>';
    quizData.questions.forEach(block => {
        block.items.forEach(item => {
            reportHtml += `<li>שאלה: ${item.questionText}<br>`;
            if (correctlyAnsweredInSession[item.id]) {
                 reportHtml += `<span class="correct">נכון.</span> תשובתך: "${item.options[item.correctAnswer]}"`;
            } else { 
                const userAnswer = document.forms['quiz-form'].elements[item.id].value;
                reportHtml += `<span class="incorrect">לא נכון.</span> `;
                if(userAnswer) {
                    reportHtml += `תשובתך הייתה: "${item.options[userAnswer]}". `;
                }
                reportHtml += `התשובה הנכונה: "${item.options[item.correctAnswer]}"`;
            }
            if(item.explanation) reportHtml += ` ${item.explanation}`;
            reportHtml += `</li>`;
        });
    });
    reportHtml += '</ol>';
    detailedAnswersDiv.innerHTML = reportHtml;

    document.querySelectorAll('#quiz-form input[type="radio"]').forEach(radio => radio.disabled = true);
    submitButton.style.display = 'none';
    resetButton.textContent = "התחל מבחן מחדש";
    resetButton.style.display = 'block';
}

function handleRetry(score) {
    const detailedAnswersDiv = document.getElementById('detailed-answers');
    const submitButton = document.querySelector('.submit-button');
    const resetButton = document.querySelector('.reset-button');
    
    document.getElementById('score-display').innerHTML += `<br><span style="color:red;">נסה/י לשפר את התוצאה! נותרו לך ${maxAttemptsPerCycle - currentAttemptInCycle} ניסיונות.</span>`;
    
    let reportHtml = '<h3>תוצאות הניסיון הנוכחי:</h3><ol>';
    quizData.questions.forEach(block => {
        block.items.forEach(item => {
            reportHtml += `<li>שאלה: ${item.questionText}<br>`;
            if (correctlyAnsweredInSession[item.id]) {
                reportHtml += `<span class="correct">נכון.</span>`;
            } else {
                 const userAnswer = document.forms['quiz-form'].elements[item.id].value;
                 if (userAnswer) {
                    reportHtml += `<span class="incorrect">לא נכון.</span> תשובתך הייתה: "${item.options[userAnswer]}".`;
                 } else {
                    reportHtml += `<span class="unanswered">אין תשובה.</span>`;
                 }
            }
            reportHtml += `</li>`;
        });
    });
    reportHtml += '</ol>';
    detailedAnswersDiv.innerHTML = reportHtml;

    // Блокировка/разблокировка вопросов
    quizData.questions.forEach(block => {
        block.items.forEach(item => {
            const radioGroup = document.forms['quiz-form'].elements[item.id];
            if (correctlyAnsweredInSession[item.id]) {
                for (const radio of radioGroup) {
                    radio.disabled = true;
                    if(radio.value === item.correctAnswer) radio.checked = true;
                }
            } else {
                for (const radio of radioGroup) {
                    radio.disabled = false;
                    radio.checked = false;
                }
            }
        });
    });

    submitButton.textContent = `בדיקה (ניסיון ${currentAttemptInCycle + 1})`;
    resetButton.style.display = 'block';
}
    
function handleFailureNoMoreAttempts() {
    const scoreDisplay = document.getElementById('score-display');
    const detailedAnswersDiv = document.getElementById('detailed-answers');
    const submitButton = document.querySelector('.submit-button');
    const resetButton = document.querySelector('.reset-button');

    scoreDisplay.innerHTML += `<br><strong style="color:red;">לצערנו, לא צברת מספיק נקודות לאחר ${maxAttemptsPerCycle} ניסיונות. המבחן יאופס.</strong>`;
    detailedAnswersDiv.innerHTML = "<p>נסה/י שוב מההתחלה!</p>";
    submitButton.style.display = 'none';
    resetButton.textContent = "התחל מבחן מחדש";
    resetButton.style.display = 'block';
    updateAttemptCounterDisplay();
}

function resetFullQuiz() {
    correctlyAnsweredInSession = {};
    currentAttemptInCycle = 0;
    updateAttemptCounterDisplay();
    
    document.getElementById('quiz-form').reset();
    document.querySelectorAll('#quiz-form input[type="radio"]').forEach(radio => radio.disabled = false);
    
    document.querySelectorAll('.feedback').forEach(el => {
        el.textContent = '';
        el.className = 'feedback';
    });
    
    document.getElementById('results-container').style.display = 'none';
    const submitBtn = document.querySelector('.submit-button');
    submitBtn.textContent = "בדיקת תשובות";
    submitBtn.style.display = 'block';
    document.querySelector('.reset-button').style.display = 'none';
}