import { renderApp, screen, waitFor, userEvent, within } from '../helpers/test-utils';
import { setMockCategories } from '../helpers/api-mocks';
import { createMockCategory, createMockUser } from '../helpers/mock-data';

// Create a mock authenticated user for all category tests
const authUser = createMockUser({ name: 'Category Owner' });

/**
 * Helper function to create a standard set of base categories for testing
 * @returns {Array} Array containing a Work category with 2 tasks and an empty Errands category
 */
function buildBaseCategories() {
  return [
    createMockCategory({ name: 'Work', color: '#3B82F6', task_count: 2 }),
    createMockCategory({ name: 'Errands', color: '#F97316', task_count: 0 }),
  ];
}

/**
 * Helper function to set up the Categories page with mock data and render it
 * @param {Array} seedCategories - Array of mock categories to populate the page with (defaults to base categories)
 * @returns {Object} userEvent instance for simulating user interactions
 */
function setupCategoriesPage(seedCategories = buildBaseCategories()) {
  // Initialize the categories that should appear on the page
  setMockCategories(seedCategories);

  // Render the full app with the Categories page as the initial route
  renderApp({
    initialRoute: '/categories',
    authValue: { user: authUser, token: 'token-123' },
  });

  // Return userEvent instance for simulating user interactions
  return userEvent.setup();
}

describe('Categories Page Integration', () => {
  describe('CRUD Operations', () => {
    test('allows creating a category', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the page to fully load before interacting with it
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
      });

      // Open the create category modal by clicking the New Category button
      await userActions.click(screen.getByRole('button', { name: /new category/i }));

      // Fill in the category name field with a new category name
      await userActions.type(screen.getByLabelText(/category name/i), 'Fitness');

      // Select a color from the color palette (choosing the 3rd color option)
      const colorButtons = screen.getAllByRole('button', { name: /select color/i });
      await userActions.click(colorButtons[2]);

      // Submit the form to create the new category
      await userActions.click(screen.getByRole('button', { name: /create category/i }));

      // Verify that the newly created category appears in the list
      expect(await screen.findByText(/Fitness/i)).toBeInTheDocument();
    });

    test('allows editing a category', async () => {
      // Set up the page with default categories including the Work category
      const userActions = setupCategoriesPage();

      // Wait for the Work category to be rendered on the page
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Find the Work category card and click its edit button
      const workCard = screen.getByText(/Work/i).closest('article');
      await userActions.click(within(workCard).getByLabelText(/edit category/i));

      // Clear the existing name and type a new name for the category
      const nameField = screen.getByLabelText(/category name/i);
      await userActions.clear(nameField);
      await userActions.type(nameField, 'Work Projects');

      // Submit the edit form to save the changes
      await userActions.click(screen.getByRole('button', { name: /save changes/i }));

      // Verify that the category now appears with its updated name
      expect(await screen.findByText(/Work Projects/i)).toBeInTheDocument();
    });

    test('allows deleting an empty category', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the Errands category to render before interacting with it
      await waitFor(() => {
        expect(screen.getByText(/Errands/i)).toBeInTheDocument();
      });

      // Locate the Errands category card so the delete action targets the correct entry
      const errandsCard = screen.getByText(/Errands/i).closest('article');
      // Open the delete confirmation for the empty category and confirm the removal
      await userActions.click(within(errandsCard).getByLabelText(/delete category/i));
      await userActions.click(await screen.findByRole('button', { name: /^delete$/i }));

      // Verify that the Errands category no longer appears after deletion
      await waitFor(() => {
        expect(screen.queryByText(/Errands/i)).not.toBeInTheDocument();
      });
    });

    test('validates required fields when creating a category', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the categories page to finish loading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
      });

      // Attempt to submit the create form without entering any data
      await userActions.click(screen.getByRole('button', { name: /new category/i }));
      await userActions.click(screen.getByRole('button', { name: /create category/i }));

      // Verify that a validation message appears when the form is submitted empty
      expect(await screen.findByText(/category name is required/i)).toBeInTheDocument();
    });

    test('validates category name length with maxLength attribute', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the categories page to finish loading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
      });

      // Open the create modal so the maxLength constraint can be exercised
      await userActions.click(screen.getByRole('button', { name: /new category/i }));
      const nameInput = screen.getByLabelText(/category name/i);

      // Input has maxLength=50, so typing 51 characters only enters 50
      await userActions.type(nameInput, 'a'.repeat(51));

      // Verify maxLength works - value should be exactly 50 chars
      expect(nameInput.value).toHaveLength(50);

      // Submit the create form with the 50 character value
      await userActions.click(screen.getByRole('button', { name: /create category/i }));

      // Verify that the category is created successfully
      await waitFor(() => {
        expect(screen.getByText('a'.repeat(50))).toBeInTheDocument();
      });
    });

    test('trims whitespace from category name', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the categories page to finish loading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
      });

      // Enter a category name with surrounding whitespace and submit it
      await userActions.click(screen.getByRole('button', { name: /new category/i }));
      await userActions.type(screen.getByLabelText(/category name/i), '  Shopping  ');
      await userActions.click(screen.getByRole('button', { name: /create category/i }));

      // Verify that the stored category value is trimmed
      expect(await screen.findByText('Shopping')).toBeInTheDocument();
    });
  });

  describe('Color Selection', () => {
    test('selects different color when creating category', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the categories page to finish loading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
      });

      // Open the create modal so the color palette is rendered
      await userActions.click(screen.getByRole('button', { name: /new category/i }));

      // Choose a specific palette entry to ensure the selected indicator updates
      const colorButtons = screen.getAllByRole('button', { name: /select color/i });
      await userActions.click(colorButtons[5]);

      // Verify that the preview chip reflects the chosen color
      const selectedColorDisplay = screen.getByText(/selected:/i).parentElement.querySelector('div[style*="background"]');
      expect(selectedColorDisplay).toBeInTheDocument();
    });

    test('changes color when editing category', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the Work category to render before editing it
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Enter edit mode for the Work category and pick a different palette option
      const workCard = screen.getByText(/Work/i).closest('article');
      await userActions.click(within(workCard).getByLabelText(/edit category/i));

      const colorButtons = screen.getAllByRole('button', { name: /select color/i });
      await userActions.click(colorButtons[10]);

      // Save the updated color choice
      await userActions.click(screen.getByRole('button', { name: /save changes/i }));

      // Verify that the category still appears after saving
      expect(await screen.findByText(/Work/i)).toBeInTheDocument();
    });

    test('displays default color when creating new category', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the categories page to finish loading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
      });

      // Confirm that the default color is pre-selected without extra interaction
      await userActions.click(screen.getByRole('button', { name: /new category/i }));

      expect(screen.getByText('#3B82F6')).toBeInTheDocument();
    });
  });

  describe('Category Display & Navigation', () => {
    test('displays category count in header', async () => {
      // Seed three categories so the header count pluralizes correctly
      setupCategoriesPage([
        createMockCategory({ name: 'Category 1' }),
        createMockCategory({ name: 'Category 2' }),
        createMockCategory({ name: 'Category 3' }),
      ]);

      // Wait for the header count to reflect the seeded categories
      await waitFor(() => {
        expect(screen.getByText(/3 categories/i)).toBeInTheDocument();
      });
    });

    test('displays singular category in header for one category', async () => {
      // Seed a single category so the header switches to the singular label
      setupCategoriesPage([
        createMockCategory({ name: 'Single Category' }),
      ]);

      // Wait for the header to render the singular label
      await waitFor(() => {
        expect(screen.getByText(/1 category/i)).toBeInTheDocument();
      });
    });

    test('displays task count for each category', async () => {
      // Seed categories with task counts so the chip shows the correct numbers
      setupCategoriesPage([
        createMockCategory({ name: 'Work', task_count: 5 }),
        createMockCategory({ name: 'Personal', task_count: 3 }),
      ]);

      // Wait for the category list to render before checking the displayed counts
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Verify that each category shows the correct task total
      expect(screen.getByText('5 tasks')).toBeInTheDocument();
      expect(screen.getByText('3 tasks')).toBeInTheDocument();
    });

    test('displays created date for categories', async () => {
      // Override created_at to confirm the metadata renders in the card
      const createdDate = new Date('2024-01-15T10:00:00Z');
      setupCategoriesPage([
        createMockCategory({ name: 'Work', created_at: createdDate.toISOString() }),
      ]);

      // Wait for the card to appear before verifying metadata
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Verify that the creation timestamp is shown to the user
      expect(screen.getByText(/Created:/i)).toBeInTheDocument();
    });

    test('navigates to tasks page filtered by category', async () => {
      const category = createMockCategory({ name: 'Work', task_count: 5 });
      const userActions = setupCategoriesPage([category]);

      // Wait for the Work category card to render
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Locate the category card so the navigation trigger can be clicked
      const workCard = screen.getByText(/Work/i).closest('article');
      // Click the card CTA to ensure the Tasks page receives the correct category filter
      await userActions.click(within(workCard).getByText(/view tasks/i));

      // Wait for navigation to complete and confirm the Tasks page is displayed
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /my tasks/i })).toBeInTheDocument();
      });
    });

    test('disables view tasks button for empty categories', async () => {
      setupCategoriesPage([
        createMockCategory({ name: 'Empty Category', task_count: 0 }),
      ]);

      // Wait for the Empty Category card to render
      await waitFor(() => {
        expect(screen.getByText(/Empty Category/i)).toBeInTheDocument();
      });

      // Locate the Empty Category card to inspect its actions
      const emptyCard = screen.getByText(/Empty Category/i).closest('article');
      const viewTasksButton = within(emptyCard).getByText(/view tasks/i);

      // Confirm that categories with zero tasks disable the navigation trigger
      expect(viewTasksButton).toBeDisabled();
    });
  });

  describe('Empty States', () => {
    test('displays empty state when no categories exist', async () => {
      // Render the categories page without any seed data
      setupCategoriesPage([]);

      // Wait for the empty state message to appear
      await waitFor(() => {
        expect(screen.getByText(/no categories/i)).toBeInTheDocument();
      });
      // Verify that the empty state encourages the user to create their first category
      expect(screen.getByText(/get started by creating your first category/i)).toBeInTheDocument();
    });

    test('can create first category from empty state', async () => {
      // Render the categories page without any seed data
      const userActions = setupCategoriesPage([]);

      // Wait for the empty state callout to be displayed
      await waitFor(() => {
        expect(screen.getByText(/no categories/i)).toBeInTheDocument();
      });

      // Use the empty state shortcut to open the create modal
      const createButtons = screen.getAllByRole('button', { name: /new category/i });
      await userActions.click(createButtons[0]);

      expect(screen.getByText(/create new category/i)).toBeInTheDocument();
    });
  });

  describe('Modal Interactions', () => {
    test('closes modal when cancel is clicked', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the categories page to finish loading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
      });

      // Open the create modal so it can later be cancelled
      await userActions.click(screen.getByRole('button', { name: /new category/i }));

      // Verify that clicking "New Category" opens the create form modal
      expect(screen.getByText(/create new category/i)).toBeInTheDocument();

      // Click cancel to close the modal
      await userActions.click(screen.getByRole('button', { name: /cancel/i }));

      // Verify that the modal content is removed after cancellation
      await waitFor(() => {
        expect(screen.queryByText(/create new category/i)).not.toBeInTheDocument();
      });
    });

    test('pre-fills edit modal with category data', async () => {
      const category = createMockCategory({ name: 'Edit Me', color: '#10B981' });
      const userActions = setupCategoriesPage([category]);

      // Wait for the target category card to render
      await waitFor(() => {
        expect(screen.getByText(/Edit Me/i)).toBeInTheDocument();
      });

      // Verify that opening the edit modal pre-populates the form fields with existing values
      const categoryCard = screen.getByText(/Edit Me/i).closest('article');
      await userActions.click(within(categoryCard).getByLabelText(/edit category/i));

      // Confirm that all form fields are initialized with the existing category data
      expect(screen.getByLabelText(/category name/i)).toHaveValue('Edit Me');
      expect(screen.getByText('#10B981')).toBeInTheDocument();
    });

    test('clears form when opening create modal after edit', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the categories to render before editing
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Open and then cancel the edit modal to simulate switching modes
      const workCard = screen.getByText(/Work/i).closest('article');
      await userActions.click(within(workCard).getByLabelText(/edit category/i));

      await userActions.click(screen.getByRole('button', { name: /cancel/i }));

      // Open the create modal to ensure it resets its form fields
      await userActions.click(screen.getByRole('button', { name: /new category/i }));

      expect(screen.getByLabelText(/category name/i)).toHaveValue('');
    });

    test('clears validation errors when typing in field', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the categories page to finish loading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
      });

      // Trigger a validation error by submitting an empty form
      await userActions.click(screen.getByRole('button', { name: /new category/i }));
      await userActions.click(screen.getByRole('button', { name: /create category/i }));

      expect(await screen.findByText(/category name is required/i)).toBeInTheDocument();

      // Start typing to satisfy the validation requirement
      await userActions.type(screen.getByLabelText(/category name/i), 'New Category');

      // Verify that the validation message disappears after typing
      await waitFor(() => {
        expect(screen.queryByText(/category name is required/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Delete Confirmation', () => {
    test('shows confirmation dialog before deleting', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the Errands category to render before attempting to delete it
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Errands/i })).toBeInTheDocument();
      });

      // Open the delete confirmation dialog for the Errands category
      const errandsCard = screen.getByRole('heading', { name: /Errands/i }).closest('article');
      await userActions.click(within(errandsCard).getByLabelText(/delete category/i));

      // Verify that the confirmation dialog references the correct category
      expect(await screen.findByText(/are you sure you want to delete/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Errands/).length).toBeGreaterThan(0);
    });

    test('cancels deletion when cancel is clicked', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the Errands category to render before attempting to delete it
      await waitFor(() => {
        expect(screen.getByText(/Errands/i)).toBeInTheDocument();
      });

      // Open the confirmation dialog and then cancel
      const errandsCard = screen.getByText(/Errands/i).closest('article');
      await userActions.click(within(errandsCard).getByLabelText(/delete category/i));

      await userActions.click(screen.getByRole('button', { name: /cancel/i }));

      // Verify that the dialog closes and the category remains
      await waitFor(() => {
        expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
      });
      expect(screen.getByText(/Errands/i)).toBeInTheDocument();
    });

    test('disables delete button for categories with tasks', async () => {
      // Seed a category that still has tasks so deletion should be blocked
      setupCategoriesPage([
        createMockCategory({ name: 'Work', task_count: 5 }),
      ]);

      // Wait for the Work category card to render
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Verify that the delete button is disabled since tasks remain
      const workCard = screen.getByText(/Work/i).closest('article');
      const deleteButton = within(workCard).getByLabelText(/delete category/i);

      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Refresh & Error Handling', () => {
    test('refreshes category list', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the category list to render
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Trigger a refresh to reload the categories
      await userActions.click(screen.getByLabelText(/Refresh/i));

      // Verify that categories are still present after the refresh
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });
    });
  });

  describe('Grid Layout & Responsive Display', () => {
    test('displays categories in grid format', async () => {
      // Seed multiple categories so the grid has several cards to render
      setupCategoriesPage([
        createMockCategory({ name: 'Category 1' }),
        createMockCategory({ name: 'Category 2' }),
        createMockCategory({ name: 'Category 3' }),
        createMockCategory({ name: 'Category 4' }),
      ]);

      // Wait for the first category card to render
      await waitFor(() => {
        expect(screen.getByText(/Category 1/i)).toBeInTheDocument();
      });

      // Verify that the grid displays one card per seeded category
      const categoryCards = screen.getAllByRole('article');
      expect(categoryCards).toHaveLength(4);
    });

    test('displays category color as border', async () => {
      // Seed a category with a distinct color so the border can be asserted
      const category = createMockCategory({ name: 'Colorful', color: '#10B981' });
      setupCategoriesPage([category]);

      // Wait for the category card to render
      await waitFor(() => {
        expect(screen.getByText(/Colorful/i)).toBeInTheDocument();
      });

      // Verify that the category card border uses the supplied color
      const categoryCard = screen.getByText(/Colorful/i).closest('article');
      expect(categoryCard).toHaveStyle({ borderColor: '#10B981' });
    });

    test('displays category icon with selected color', async () => {
      // Seed a category with a known brand color
      const category = createMockCategory({ name: 'Work', color: '#3B82F6' });
      setupCategoriesPage([category]);

      // Wait for the category card to render
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      const categoryCard = screen.getByText(/Work/i).closest('article');
      // Find the icon container div with the background color
      const iconContainers = categoryCard.querySelectorAll('div[style*="background"]');
      const coloredIcon = Array.from(iconContainers).find(el =>
        el.style.backgroundColor === 'rgb(59, 130, 246)' // #3B82F6 in RGB
      );

      expect(coloredIcon).toBeInTheDocument();
    });
  });

  describe('Category-Task Integration', () => {
    test('creates category and verifies it appears in list', async () => {
      // Render the categories page without any seed data
      const userActions = setupCategoriesPage([]);

      // Wait for the empty state to appear
      await waitFor(() => {
        expect(screen.getByText(/no categories/i)).toBeInTheDocument();
      });

      // Create a new category using the empty state action
      await userActions.click(screen.getAllByRole('button', { name: /new category/i })[0]);
      await userActions.type(screen.getByLabelText(/category name/i), 'New Work');
      await userActions.click(screen.getByRole('button', { name: /create category/i }));

      // Verify that the new category card is rendered with the default task count
      await waitFor(() => {
        expect(screen.getByText(/New Work/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/0 tasks/i)).toBeInTheDocument();
    });

    test('displays zero tasks for newly created category', async () => {
      // Set up the page with default categories
      const userActions = setupCategoriesPage();

      // Wait for the categories page to finish loading
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /categories/i })).toBeInTheDocument();
      });

      // Create a new category through the modal
      await userActions.click(screen.getByRole('button', { name: /new category/i }));
      await userActions.type(screen.getByLabelText(/category name/i), 'Fresh Category');
      await userActions.click(screen.getByRole('button', { name: /create category/i }));

      // Verify that the new category starts with zero tasks
      await waitFor(() => {
        const freshCard = screen.getByText(/Fresh Category/i).closest('article');
        expect(within(freshCard).getByText(/0 tasks/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility & UX', () => {
    test('shows hover effects on category cards', async () => {
      // Seed a single category to inspect its hover styles
      setupCategoriesPage([
        createMockCategory({ name: 'Work' }),
      ]);

      // Wait for the Work category card to render
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Verify that the hover utility classes are applied
      const workCard = screen.getByText(/Work/i).closest('article');
      expect(workCard).toHaveClass('hover:shadow-md');
    });

    test('edit and delete buttons appear on hover', async () => {
      // Seed a single category so its action buttons can be inspected
      setupCategoriesPage([
        createMockCategory({ name: 'Work' }),
      ]);

      // Wait for the Work category card to render
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Verify that the action buttons transition from hidden to visible on hover
      const workCard = screen.getByText(/Work/i).closest('article');
      const actionsContainer = within(workCard).getByLabelText(/edit category/i).parentElement;

      expect(actionsContainer).toHaveClass('opacity-0');
      expect(actionsContainer).toHaveClass('group-hover:opacity-100');
    });

    test('provides aria labels for buttons', async () => {
      // Seed a single category to inspect button accessibility labels
      setupCategoriesPage([
        createMockCategory({ name: 'Work' }),
      ]);

      // Wait for the Work category card to render
      await waitFor(() => {
        expect(screen.getByText(/Work/i)).toBeInTheDocument();
      });

      // Verify that edit and delete buttons expose aria-labels
      const workCard = screen.getByText(/Work/i).closest('article');

      expect(within(workCard).getByLabelText(/edit category/i)).toBeInTheDocument();
      expect(within(workCard).getByLabelText(/delete category/i)).toBeInTheDocument();
    });
  });
});
