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
import { ChevronsUpDown, Eye, EyeOff } from 'lucide-react'
import { getRegistryEntry, isFieldLockedVisible } from '@/config/orderDisplayFields'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import { cn } from '@/lib/utils'
import type { OrderFieldConfigItem } from '@/types/orderDisplay'
import {
  fieldIconClass,
  fieldLabelClass,
  settingsSectionTitleClass,
} from '@/components/orderFields/orderFieldSettingsStyles'

interface OrderFieldListProps {
  /** When false, list is display-only (no drag or visibility toggle). */
  isEditable?: boolean
}

interface FieldRowProps {
  field: OrderFieldConfigItem
  onToggleVisible: (key: OrderFieldConfigItem['key']) => void
}

function ReadOnlyFieldRow({ field }: { field: OrderFieldConfigItem }) {
  const label = getRegistryEntry(field.key).label
  const visible = field.visible

  return (
    <li className="flex h-[30px] items-center gap-2 py-1">
      <span
        className={cn(
          'flex h-5 w-5 flex-shrink-0 items-center justify-center',
          fieldIconClass(visible),
        )}
        aria-hidden
      >
        <ChevronsUpDown className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className={fieldLabelClass(visible)}>{label}</span>
      <span
        className={cn(
          'ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center',
          fieldIconClass(visible),
        )}
        aria-hidden
      >
        {visible ? (
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
  const visible = field.visible

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
        'flex h-[30px] items-center gap-2 py-1',
        isDragging && 'z-10 rounded-lg bg-white shadow-md',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className={cn(
          'flex h-5 w-5 flex-shrink-0 cursor-grab items-center justify-center border-0 bg-transparent p-0',
          'active:cursor-grabbing',
          fieldIconClass(visible),
        )}
        aria-label={`拖曳調整${label}順序`}
        {...attributes}
        {...listeners}
      >
        <ChevronsUpDown className="h-5 w-5" strokeWidth={2} />
      </button>
      <span className={fieldLabelClass(visible)}>{label}</span>
      <button
        type="button"
        disabled={locked}
        onClick={() => onToggleVisible(field.key)}
        aria-label={visible ? `隱藏${label}` : `顯示${label}`}
        aria-pressed={visible}
        className={cn(
          'ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center border-0 bg-transparent p-0',
          locked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
          fieldIconClass(visible),
        )}
      >
        {visible ? (
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
    <ul className="m-0 flex list-none flex-col gap-2">
      {sortedDraftFields.map(field =>
        isEditable ? (
          <EditableFieldRow
            key={field.key}
            field={field}
            onToggleVisible={toggleVisible}
          />
        ) : (
          <ReadOnlyFieldRow key={field.key} field={field} />
        ),
      )}
    </ul>
  )

  return (
    <>
      <h3 className={settingsSectionTitleClass}>選擇欄位與順序</h3>
      <div className="mt-4 flex-1">
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
    </>
  )
}
