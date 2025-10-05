// Categories data
let categories = [
    { name: 'Shopping', icon: 'fa-shopping-cart' },
    { name: 'Food', icon: 'fa-utensils' },
    { name: 'Housing', icon: 'fa-home' },
    { name: 'Transport', icon: 'fa-car' }
];

// Show category modal
function showAddCategoryModal() {
    document.getElementById('categoryModal').style.display = 'block';
}

// Close category modal
function closeCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
}

// Add new category
function addNewCategory() {
    const name = document.getElementById('categoryName').value;
    const icon = document.getElementById('categoryIcon').value;
    
    if (!name) {
        alert('Please enter a category name');
        return;
    }
    
    categories.push({ name, icon });
    updateCategoryOptions();
    closeCategoryModal();
    document.getElementById('categoryName').value = '';
}

// Update category options
function updateCategoryOptions() {
    const categorySelectors = document.querySelectorAll('.category-selector');
    categorySelectors.forEach(selector => {
        selector.innerHTML = categories.map(cat => `
            <div class="category-option" onclick="updateTransactionCategory(this)" data-category="${cat.name}">
                <i class="fas ${cat.icon}"></i>
                ${cat.name}
            </div>
        `).join('');
    });
}

// Export transactions
function exportTransactions() {
    // Sample transaction data - replace with your actual data
    const transactions = [
        { date: '2023-08-01', description: 'Grocery Shopping', amount: 150.00, category: 'Shopping' },
        { date: '2023-08-02', description: 'Restaurant', amount: 45.00, category: 'Food' }
    ];

    // Create CSV content
    const csvContent = 'Date,Description,Amount,Category\n' +
        transactions.map(t => `${t.date},"${t.description}",${t.amount},${t.category}`).join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Initialize when document is loaded
document.addEventListener('DOMContentLoaded', function() {
    updateCategoryOptions();
});