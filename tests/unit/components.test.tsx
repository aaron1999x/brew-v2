import { render, screen } from '@testing-library/react';
import { Star } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import {
  SyncBadge,
  VerifiedBadge,
  VersionBadge,
  VisibilityBadge,
} from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { NoticeItem, RecipeCard, RowList } from '@/components/ui/Card/Card';
import { Icon } from '@/components/ui/Icon/Icon';

describe('Icon', () => {
  it('is hidden from assistive technology by default', () => {
    const { container } = render(<Icon icon={Star} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('is announced as an image when it has a label', () => {
    render(<Icon icon={Star} label="Favourite" />);
    expect(screen.getByRole('img', { name: 'Favourite' })).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('keeps its label in the DOM and marks itself pending', () => {
    render(
      <Button isPending pendingLabel="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-pending', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveTextContent('Save');
    expect(screen.getByRole('progressbar', { name: 'Saving…' })).toBeInTheDocument();
  });

  it('marks medium and large buttons as primary controls, not small ones', () => {
    render(
      <>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Small' })).not.toHaveAttribute(
      'data-primary-control',
    );
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('data-primary-control');
    expect(screen.getByRole('button', { name: 'Large' })).toHaveAttribute('data-primary-control');
  });
});

describe('badges', () => {
  it('always carry text, never colour alone', () => {
    render(
      <>
        <VerifiedBadge />
        <VisibilityBadge visibility="hidden" />
        <VersionBadge version={4} />
        <SyncBadge state="waiting" />
      </>,
    );
    for (const text of ['Verified', 'Hidden', 'v4', 'Waiting to sync']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });
});

describe('cards', () => {
  it('gives a recipe card one link, named by the recipe', () => {
    const { container } = render(
      <RecipeCard
        name="Washed Ethiopia"
        authorName="Aaron Tan"
        verified
        method="V60"
        keyNumbers={[{ label: 'Dose', value: '18 g' }]}
        version={3}
        brewCount={1}
        saveCount={2}
        href="/recipes/1"
      />,
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Washed Ethiopia' })).toHaveAttribute(
      'href',
      '/recipes/1',
    );
    expect(container).toHaveTextContent('1 brew');
    expect(container).toHaveTextContent('2 saves');
  });

  it('says "Unread" for unread notices', () => {
    render(
      <RowList label="Notices">
        <NoticeItem message="Your recipe was verified." timeLabel="2 h ago" unread />
        <NoticeItem message="Welcome." timeLabel="3 d ago" />
      </RowList>,
    );
    const [unread, read] = screen.getAllByRole('listitem');
    expect(unread).toHaveTextContent('Unread: Your recipe was verified.');
    expect(read).not.toHaveTextContent('Unread');
  });
});
