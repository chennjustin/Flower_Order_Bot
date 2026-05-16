import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical } from 'lucide-react'
import { getRegistryEntry, isFieldLockedVisible } from '@/config/orderDisplayFields'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import { cn } from '@/lib/utils'
import type { OrderFieldConfigItem } from '@/types/orderDisplay'

interface OrderFieldListProps {
  /** When false, list is display-only (no drag or visibility toggle). */
  isEditable?: boolean
}

interface FieldRowProps {
  field: OrderFieldConfigItem
  isEditable: boolean
  onToggleVisible: (key: OrderFieldConfigItem['key']) => void
}

function ReadOnlyFieldRow({ field }: { field: OrderFieldConfigItem }) {
  const label = getRegistryEntry(field.key).label

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-lg px-2 py-2.5',
        !field.visible && 'opacity-70',
      )}
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-black/20"
        aria-hidden
      >
        <GripVertical className="h-5 w-5" strokeWidth={2} />
      </span>
      <span
        className={cn(
          'flex-1 text-base font-medium font-["Noto_Sans_TC",sans-serif]',
          field.visible ? 'text-black' : 'text-black/40',
        )}
      >
        {label}
      </span>
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-black/25"
        aria-hidden
      >
        {field.visible ? (
          <Eye className="h-5 w-5" strokeWidth={2} />
        ) : (
          <EyeOff className="h-5 w-5" strokeWidth={2} />
        )}
      </span>
    </li>
  )
}

function EditableFieldRow({ field, onToggleVisible }: FieldRowProps) {
  const label = getRegistryEntry(field.key).label
  const locked = isFieldLockedVisible(field.key)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 rounded-lg px-2 py-2.5',
        !field.visible && 'opacity-70',
        isDragging && 'z-10 bg-white shadow-md',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="flex h-9 w-9 flex-shrink-0 cursor-grab items-center justify-center rounded-md border-0 bg-transparent text-[#999] active:cursor-grabbing hover:bg-black/5"
        aria-label={`拖曳調整${label}順序`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" strokeWidth={2} />
      </button>
      <span
        className={cn(
          'flex-1 text-base font-medium font-["Noto_Sans_TC",sans-serif]',
          field.visible ? 'text-black' : 'text-black/40',
        )}
      >
        {label}
      </span>
      <button
        type="button"
        disabled={locked}
        onClick={() => onToggleVisible(field.key)}
        aria-label={field.visible ? `隱藏${label}` : `顯示${label}`}
        aria-pressed={field.visible}
        className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border-0 bg-transparent transition-colors',
          locked
            ? 'cursor-not-allowed text-black/25'
            : 'cursor-pointer text-[#555] hover:bg-black/5',
        )}
      >
        {field.visible ? (
          <Eye className="h-5 w-5" strokeWidth={2} />
        ) : (
          <EyeOff className="h-5 w-5" strokeWidth={2} />
        )}
      </button>
    </li>
  )
}

/**
 * Configurable field list with drag-and-drop ordering and visibility toggles.
 */
export default function OrderFieldList({ isEditable = false }: OrderFieldListProps) {
  const { sortedDraftFields, toggleVisible, reorder } = useOrderDisplayConfig()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const sortableIds = sortedDraftFields.map(field => field.key)

  function handleDragEnd(event: DragEndEvent) {
    if (!isEditable) {
      return
    }
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    const fromIndex = sortedDraftFields.findIndex(field => field.key === active.id)
    const toIndex = sortedDraftFields.findIndex(field => field.key === over.id)
    if (fromIndex === -1 || toIndex === -1) {
      return
    }
    reorder(fromIndex, toIndex)
  }

  const listContent = (
    <ul className="m-0 flex list-none flex-col gap-1">
      {sortedDraftFields.map(field =>
        isEditable ? (
          <EditableFieldRow
            key={field.key}
            field={field}
            isEditable
            onToggleVisible={toggleVisible}
          />
        ) : (
          <ReadOnlyFieldRow key={field.key} field={field} />
        ),
      )}
    </ul>
  )

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-bold text-[#333] font-['Noto_Sans_TC',sans-serif]">
        選擇欄位與順序
      </h3>
      {isEditable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {listContent}
          </SortableContext>
        </DndContext>
      ) : (
        listContent
      )}
    </div>
  )
}
