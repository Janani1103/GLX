export default function PageHeader({ title, description, actions }) {
    return (
        <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between gap-2 xs:gap-3 mb-4 sm:mb-6">
            <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-tight">{title}</h1>
                {description && (
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{description}</p>
                )}
            </div>
            {actions && (
                <div className="flex flex-wrap gap-2 items-center flex-shrink-0">
                    {actions}
                </div>
            )}
        </div>
    );
}