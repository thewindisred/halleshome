(function () {
    const MOBILE_MAX_WIDTH = 768;
    const SECTION_CONFIGS = [
        { selector: '.tools', label: 'Tools', openByDefault: true },
        { selector: '.purchase-shop', label: 'Water & Fertilizer', openByDefault: false },
        { selector: '.seed-shop', label: 'Seed Shop', openByDefault: true },
        { selector: '.sprinkler-shop', label: 'Sprinklers', openByDefault: false },
        { selector: '.decoration-shop', label: 'Decorations', openByDefault: false },
        { selector: '.achievements-section', label: 'Achievements', openByDefault: false },
        { selector: '.challenges-section', label: 'Challenges', openByDefault: false },
        { selector: '.stats-section', label: 'Garden Stats', openByDefault: false },
        { selector: '.instructions', label: 'How To Play', openByDefault: false }
    ];

    let mobileLayoutApplied = false;
    let resizeTimerId;

    const shouldUseMobileLayout = () => {
        const width = window.innerWidth;
        if (width <= MOBILE_MAX_WIDTH) {
            return true;
        }

        const orientationQuery = window.matchMedia('(orientation: portrait)');
        const isPortrait = orientationQuery && orientationQuery.matches;
        return Boolean(isPortrait && width <= 1024);
    };

    const sanitizeLabel = (rawLabel, fallback) => {
        if (typeof rawLabel === 'string') {
            const trimmed = rawLabel.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
        return fallback;
    };

    const applyHeadingHiding = (section) => {
        const heading = section.querySelector('h3, h4, h2');
        if (!heading) {
            return null;
        }
        heading.classList.add('mobile-hide-heading');
        section.dataset.mobileHeadingHidden = 'true';
        return heading;
    };

    const restoreHeading = (section) => {
        if (section.dataset.mobileHeadingHidden === 'true') {
            const hidden = section.querySelector('.mobile-hide-heading');
            if (hidden) {
                hidden.classList.remove('mobile-hide-heading');
            }
            delete section.dataset.mobileHeadingHidden;
        }
    };

    const createWrapper = (section, config, index) => {
        const heading = section.querySelector('h3, h4, h2');
        const rawLabel = config.label || (heading ? heading.textContent : null);
        const label = sanitizeLabel(rawLabel, `Section ${index + 1}`);

        const wrapper = document.createElement('div');
        wrapper.className = 'mobile-collapsible';
        wrapper.dataset.mobileWrapper = 'true';

        const headerButton = document.createElement('button');
        headerButton.type = 'button';
        headerButton.className = 'mobile-collapse-header';
        headerButton.innerHTML = `<span>${label}</span><span class="mobile-collapse-icon">›</span>`;

        const content = document.createElement('div');
        content.className = 'mobile-collapse-content';
        const contentId = section.id ? `${section.id}-mobile-content` : `mobile-section-${index}-content`;
        content.id = contentId;
        headerButton.setAttribute('aria-controls', contentId);

        const shouldOpen = Boolean(config.openByDefault);
        headerButton.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
        if (shouldOpen) {
            wrapper.classList.add('open');
        }

        section.parentNode.insertBefore(wrapper, section);
        wrapper.appendChild(headerButton);
        wrapper.appendChild(content);
        content.appendChild(section);

        headerButton.addEventListener('click', () => {
            const isOpen = wrapper.classList.toggle('open');
            headerButton.setAttribute('aria-expanded', String(isOpen));
        });

        if (heading) {
            applyHeadingHiding(section);
        }

        section.dataset.mobileWrapped = 'true';
    };

    const enhanceSidebar = () => {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) {
            return;
        }

        SECTION_CONFIGS.forEach((config, index) => {
            const section = sidebar.querySelector(config.selector);
            if (!section || section.dataset.mobileWrapped === 'true') {
                return;
            }
            createWrapper(section, config, index);
        });

        mobileLayoutApplied = true;
    };

    const restoreSidebar = () => {
        const wrappers = document.querySelectorAll('[data-mobile-wrapper="true"]');
        wrappers.forEach(wrapper => {
            const content = wrapper.querySelector('.mobile-collapse-content');
            const section = content ? content.firstElementChild : null;
            if (!section) {
                wrapper.remove();
                return;
            }

            restoreHeading(section);
            delete section.dataset.mobileWrapped;
            wrapper.parentNode.insertBefore(section, wrapper);
            wrapper.remove();
        });

        mobileLayoutApplied = false;
    };

    const applyMobileLayout = () => {
        if (shouldUseMobileLayout()) {
            if (!mobileLayoutApplied) {
                enhanceSidebar();
            }
        } else if (mobileLayoutApplied) {
            restoreSidebar();
        }
    };

    document.addEventListener('DOMContentLoaded', applyMobileLayout);

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimerId);
        resizeTimerId = setTimeout(applyMobileLayout, 150);
    });

    window.addEventListener('orientationchange', applyMobileLayout);
})();
