import type { PolicyPart } from './types';

export const part1: PolicyPart = {
  id: 'part-1',
  label: 'Part I',
  title: 'Introduction, Scope, Definitions, and Acceptance',
  sections: [
    {
      id: 'introduction',
      number: 1,
      heading: 'Introduction',
      blocks: [
        {
          type: 'p',
          text: 'Welcome to Fazl APP ("Fazl APP," "Company," "we," "our," or "us"). We are committed to protecting the privacy, confidentiality, and security of the personal information entrusted to us by our customers, businesses, service providers, delivery partners, advertisers, and all other users who access or use our Platform.',
        },
        {
          type: 'p',
          text: 'This Privacy Policy explains how Fazl APP collects, uses, processes, stores, shares, protects, and otherwise handles personal information when users access or use the Fazl APP mobile application, website, business portal, administrative dashboard, APIs, communication tools, digital services, and any other products or services operated by Fazl APP (collectively referred to as the "Platform").',
        },
        {
          type: 'p',
          text: 'Privacy is an essential component of user trust. Fazl APP recognizes that users expect their personal information to be handled responsibly, transparently, and in accordance with applicable privacy and data protection laws. Accordingly, this Privacy Policy has been developed to provide users with a clear understanding of our information handling practices throughout the lifecycle of their interaction with the Platform.',
        },
        {
          type: 'p',
          text: 'Because Fazl APP operates a multi-category digital marketplace connecting customers with businesses, service providers, retailers, professionals, property owners, employers, delivery partners, and other participants, different categories of users may provide different types of information depending upon the services they use. This Privacy Policy applies broadly across all Platform services unless a separate privacy notice expressly applies to a particular product, feature, or service.',
        },
        {
          type: 'p',
          text: "Our Platform offers numerous functionalities, including but not limited to business discovery, reverse marketplace requests, business profiles, product listings, service listings, private listings, area broadcasting, messaging, community features, payment services, subscriptions, advertising services, customer support, verification services, delivery coordination, employment opportunities, property listings, promotional campaigns, analytics, and administrative services. The information collected may therefore vary according to the nature of a user's interaction with the Platform.",
        },
        {
          type: 'p',
          text: 'This Privacy Policy should be read together with our Terms and Conditions, Cookie Policy, Community Guidelines, Subscription Terms, Payment Policies, and any additional legal documents or notices published by Fazl APP. Where a specific service is governed by supplementary privacy terms, those supplementary terms shall apply in addition to this Privacy Policy to the extent of any inconsistency.',
        },
        {
          type: 'p',
          text: 'Fazl APP is committed to collecting only such information as is reasonably necessary to operate the Platform, provide requested services, improve user experience, maintain Platform security, comply with applicable legal obligations, prevent fraud, enforce our contractual rights, and support the continued development of our marketplace ecosystem.',
        },
        {
          type: 'p',
          text: 'We continually evaluate our privacy practices to ensure that they remain aligned with evolving legal requirements, technological developments, cybersecurity standards, industry best practices, and user expectations. As our Platform grows and new services are introduced, our methods of collecting and processing information may also evolve. Where material changes are made, users will be informed in accordance with this Privacy Policy and applicable law.',
        },
        {
          type: 'p',
          text: 'Nothing contained within this Privacy Policy shall be interpreted as limiting any mandatory rights granted to users under applicable privacy, consumer protection, or data protection legislation. Where local law provides greater privacy protections than those described in this Policy, Fazl APP will comply with the applicable legal requirements to the extent required.',
        },
        {
          type: 'p',
          text: 'By accessing, registering for, or otherwise using the Platform, users acknowledge that they have read this Privacy Policy and understand how their information may be collected, used, disclosed, retained, and protected in accordance with the practices described herein.',
        },
      ],
    },
    {
      id: 'scope',
      number: 2,
      heading: 'Scope of this Privacy Policy',
      blocks: [
        {
          type: 'p',
          text: 'This Privacy Policy applies to all individuals and organizations that access, browse, register for, communicate through, advertise on, purchase from, sell through, or otherwise use the Fazl APP Platform in any capacity. This includes, without limitation, customers, businesses, merchants, retailers, manufacturers, wholesalers, service providers, freelancers, contractors, delivery partners, property owners, employers, job seekers, advertisers, marketing partners, support representatives, and visitors who interact with the Platform without creating an account.',
        },
        {
          type: 'p',
          text: 'The Policy applies to personal information collected through all official Fazl APP services, including our mobile applications, websites, web portals, administrative dashboards, APIs, messaging systems, customer support channels, online forms, verification processes, promotional campaigns, surveys, events, social media interactions where applicable, and any future digital services operated by Fazl APP that reference this Privacy Policy.',
        },
        {
          type: 'p',
          text: 'This Privacy Policy governs information collected directly from users, automatically through the operation of the Platform, from integrated third-party service providers, from publicly available sources where permitted by law, and from business partners who assist in providing Platform services. The categories of information collected and the purposes for which such information is processed are described in the subsequent Parts of this Privacy Policy.',
        },
        {
          type: 'p',
          text: 'The Policy applies regardless of the device or technology used to access the Platform, including smartphones, tablets, desktop computers, laptops, wearable devices, smart televisions, web browsers, application programming interfaces, or any other compatible technologies through which Platform services are made available.',
        },
        {
          type: 'p',
          text: 'Certain Platform services may integrate with third-party providers, including payment processors, mapping services, communication platforms, identity verification providers, analytics providers, advertising partners, logistics companies, cloud infrastructure providers, and authentication services. While this Privacy Policy explains how Fazl APP handles information shared with or received from such providers, the independent privacy practices of those third parties remain subject to their respective privacy policies and legal obligations.',
        },
        {
          type: 'p',
          text: 'This Privacy Policy does not apply to websites, mobile applications, products, or services operated by third parties that are merely linked to or integrated with the Platform. Users who access third-party services through links or integrations provided by Fazl APP should review the privacy policies of those third parties before providing personal information or using their services.',
        },
        {
          type: 'p',
          text: 'The Policy also does not govern information processed by independent businesses regarding their own customers outside the operation of the Platform. Once a customer and business establish a direct commercial relationship beyond the Platform, the business may become independently responsible for complying with applicable privacy and data protection laws regarding the information it collects directly from the customer.',
        },
        {
          type: 'p',
          text: 'Where local laws impose additional privacy obligations or provide users with enhanced rights concerning the collection, processing, storage, transfer, or deletion of personal information, Fazl APP will comply with such legal requirements to the extent applicable to the relevant users and jurisdictions.',
        },
        {
          type: 'p',
          text: "This Privacy Policy remains applicable throughout the duration of a user's relationship with Fazl APP and, where appropriate, continues to apply after an account has been suspended, closed, or terminated with respect to information that Fazl APP is legally entitled or required to retain for legitimate business, legal, regulatory, security, fraud prevention, dispute resolution, accounting, or compliance purposes.",
        },
      ],
    },
    {
      id: 'definitions',
      number: 3,
      heading: 'Definitions',
      blocks: [
        {
          type: 'p',
          text: 'For the purposes of this Privacy Policy, the following terms shall have the meanings assigned to them below unless the context expressly requires otherwise. These definitions are intended to promote clarity and consistency throughout this Privacy Policy and should be interpreted together with any definitions contained in the Terms and Conditions where applicable.',
        },
        {
          type: 'dl',
          items: [
            {
              term: '"Fazl APP," "Company," "we," "our," and "us"',
              definition:
                'mean Fazl APP, together with its parent entities, subsidiaries, affiliates, successors, assigns, contractors, service providers, employees, officers, directors, agents, and any legal entity responsible for operating, maintaining, managing, or supporting the Platform.',
            },
            {
              term: '"Platform"',
              definition:
                'means the Fazl APP mobile applications, websites, web portals, business dashboards, administrative interfaces, application programming interfaces (APIs), communication systems, software, digital infrastructure, and all associated products, technologies, and services operated or made available by Fazl APP.',
            },
            {
              term: '"User"',
              definition:
                'means any individual or legal entity that accesses, visits, registers for, browses, communicates through, advertises on, purchases from, sells through, or otherwise interacts with the Platform, whether or not such individual creates a registered account.',
            },
            {
              term: '"Customer"',
              definition:
                'means any User who utilizes the Platform to discover businesses, submit marketplace requests, purchase products, book services, hire professionals, communicate with businesses, or otherwise obtain goods or services through the Platform.',
            },
            {
              term: '"Business"',
              definition:
                'means any merchant, retailer, manufacturer, supplier, wholesaler, service provider, freelancer, contractor, consultant, professional, property owner, employer, organization, company, or other commercial entity that uses the Platform to offer products, services, employment opportunities, property, or other commercial offerings.',
            },
            {
              term: '"Personal Information," "Personal Data," or "Information"',
              definition:
                'means any information that identifies, relates to, describes, can reasonably be associated with, or could directly or indirectly identify an individual. Depending upon applicable law, Personal Information may include names, contact details, identification numbers, photographs, payment information, location information, device identifiers, online identifiers, communications, transaction history, verification documents, and other information described in this Privacy Policy.',
            },
            {
              term: '"Processing"',
              definition:
                'means any operation or set of operations performed on Personal Information, whether by automated or manual means, including collecting, recording, organizing, structuring, storing, adapting, modifying, retrieving, consulting, using, disclosing, transmitting, sharing, combining, restricting, anonymizing, deleting, destroying, or otherwise handling such information.',
            },
            {
              term: '"Service Provider"',
              definition:
                'means any third party engaged by Fazl APP to provide services on behalf of the Company, including cloud hosting providers, payment processors, analytics providers, customer support providers, verification partners, communication service providers, fraud prevention providers, cybersecurity vendors, logistics integrations, and similar operational partners.',
            },
            {
              term: '"Third Party"',
              definition:
                'means any individual, organization, governmental authority, company, or entity other than Fazl APP, the User, or a Service Provider acting directly on behalf of Fazl APP.',
            },
            {
              term: '"Applicable Law"',
              definition:
                'means all applicable privacy laws, consumer protection laws, electronic transaction laws, data protection regulations, cybersecurity legislation, court orders, governmental directives, industry standards, and legally binding regulatory requirements applicable to the collection, processing, storage, disclosure, transfer, or protection of Personal Information.',
            },
            {
              term: '"Cookies"',
              definition:
                'include cookies, pixels, software development kits (SDKs), web beacons, local storage technologies, device identifiers, and similar technologies that collect or store information when users interact with the Platform.',
            },
            {
              term: '"Account"',
              definition:
                'means a registered user profile created within the Platform that enables access to one or more Platform services, features, subscriptions, communications, or business functions.',
            },
            {
              term: '"Content"',
              definition:
                'means any information, listings, reviews, ratings, comments, messages, images, videos, audio recordings, documents, advertisements, business profiles, customer requests, product information, service descriptions, promotional material, or other digital content made available through the Platform.',
            },
          ],
        },
        {
          type: 'p',
          text: 'Unless the context clearly requires otherwise, words used in the singular include the plural, words in the plural include the singular, references to one gender include all genders, and references to persons include natural persons, partnerships, corporations, governmental bodies, and other legal entities.',
        },
        {
          type: 'p',
          text: 'The headings used within this Privacy Policy are included solely for convenience of reference and shall not affect the interpretation or legal meaning of any provision contained herein.',
        },
      ],
    },
    {
      id: 'acceptance',
      number: 4,
      heading: 'Acceptance of this Privacy Policy',
      blocks: [
        {
          type: 'p',
          text: 'By accessing, downloading, installing, registering for, browsing, or otherwise using the Platform, each User acknowledges that they have carefully read, understood, and agreed to the collection, use, disclosure, storage, retention, transfer, and other processing of their Personal Information as described in this Privacy Policy.',
        },
        {
          type: 'p',
          text: 'Where registration or account creation is required, users may be asked to indicate their acceptance by clicking an "Accept," "Agree," "Continue," "Register," or similarly designated button or by completing another electronic confirmation process made available through the Platform. Such electronic acceptance shall have the same legal force and effect as a handwritten signature to the fullest extent permitted by applicable law.',
        },
        {
          type: 'p',
          text: 'Users further acknowledge that certain categories of Personal Information may be necessary for Fazl APP to provide requested services, verify identities, facilitate commercial transactions, maintain Platform security, comply with legal obligations, prevent fraud, investigate complaints, or otherwise operate the Platform effectively. Where users choose not to provide information that is reasonably necessary for these purposes, certain Platform features or services may become unavailable, restricted, or incapable of functioning as intended.',
        },
        {
          type: 'p',
          text: 'Where the User provides Personal Information relating to another individual, including employees, representatives, family members, customers, business partners, or other third parties, the User represents and warrants that they possess all necessary authority, permissions, legal rights, or lawful bases required to disclose such information to Fazl APP for the purposes described in this Privacy Policy.',
        },
        {
          type: 'p',
          text: 'Businesses using the Platform acknowledge that they may independently collect and process Personal Information relating to their own customers, employees, contractors, suppliers, or other individuals. Such processing remains the independent responsibility of the relevant Business except where Fazl APP expressly acts as a data processor or otherwise assumes specific legal responsibilities under a separate written agreement.',
        },
        {
          type: 'p',
          text: 'Users understand that the continued use of the Platform after any revision, amendment, or update to this Privacy Policy constitutes acceptance of the revised Policy unless applicable law requires separate or additional consent. Where legally required, Fazl APP will obtain appropriate consent before processing Personal Information for new purposes requiring such consent.',
        },
        {
          type: 'p',
          text: 'Nothing contained within this Privacy Policy shall be interpreted as limiting any rights granted to users under applicable privacy legislation regarding consent, withdrawal of consent, access to Personal Information, correction of inaccurate information, deletion requests, objections to processing, data portability, or other statutory privacy rights.',
        },
        {
          type: 'p',
          text: "If a User does not agree with this Privacy Policy or any future amendments, the User must immediately discontinue use of the Platform and, where applicable, request the closure of their account in accordance with the procedures made available by Fazl APP. Continued use of the Platform following the effective date of this Privacy Policy signifies the User's ongoing acknowledgement and acceptance of its terms.",
        },
      ],
    },
    {
      id: 'changes-part-1',
      number: 5,
      heading: 'Changes to this Privacy Policy',
      blocks: [
        {
          type: 'p',
          text: 'Fazl APP continually develops its Platform, introduces new technologies, expands its services, integrates with additional business partners, and adapts its operations to comply with evolving legal, regulatory, and industry requirements. As a result, this Privacy Policy may be amended, updated, supplemented, or replaced from time to time to accurately reflect our current information handling practices.',
        },
        {
          type: 'p',
          text: 'The Company reserves the right to modify any provision of this Privacy Policy at its sole discretion, provided that such modifications are made in accordance with applicable law. Changes may become necessary for numerous reasons, including but not limited to the introduction of new Platform features, improvements to existing services, implementation of enhanced security measures, changes in business operations, technological developments, modifications to applicable laws or regulations, judicial decisions, regulatory guidance, industry standards, or changes in the manner in which Personal Information is collected, processed, stored, transferred, or protected.',
        },
        {
          type: 'p',
          text: "Where material changes are made to this Privacy Policy, Fazl APP may notify users through one or more communication channels, including in-app notifications, website announcements, account dashboards, email communications, push notifications, SMS notifications, or any other reasonable method of communication available to the Company. The method of notification may vary depending upon the nature of the change, applicable legal requirements, the services affected, and the user's communication preferences.",
        },
        {
          type: 'p',
          text: "Minor revisions, editorial corrections, formatting updates, clarification of existing provisions, or administrative modifications that do not materially affect users' privacy rights may become effective immediately upon publication without separate notice unless otherwise required by applicable law.",
        },
        {
          type: 'p',
          text: 'Where applicable privacy legislation requires user consent before implementing specific changes affecting the processing of Personal Information, Fazl APP shall obtain such consent through appropriate mechanisms before commencing the relevant processing activities. Nothing contained within this Privacy Policy shall be interpreted as permitting the Company to process Personal Information in a manner that would require consent under applicable law without first obtaining such consent.',
        },
        {
          type: 'p',
          text: 'Users are encouraged to review this Privacy Policy periodically to remain informed regarding how their Personal Information is collected, used, shared, retained, protected, and otherwise processed. The latest version of this Privacy Policy shall always be made available through the Platform together with its effective date or revision date where appropriate.',
        },
        {
          type: 'p',
          text: "Unless otherwise required by applicable law, a user's continued access to or use of the Platform following the effective date of an updated Privacy Policy shall constitute acknowledgement of the revised Policy. However, where mandatory legal requirements provide users with the right to object, withdraw consent, or terminate their relationship with the Platform following particular amendments, Fazl APP will respect and facilitate such rights in accordance with applicable legislation.",
        },
        {
          type: 'p',
          text: 'Historical versions of this Privacy Policy may be retained by Fazl APP for legal, regulatory, audit, compliance, recordkeeping, dispute resolution, or business continuity purposes. The retention of previous versions shall not create any obligation upon the Company to continue applying outdated privacy practices once a revised Privacy Policy becomes effective.',
        },
      ],
    },
    {
      id: 'eligibility-children',
      number: 6,
      heading: "Eligibility and Children's Privacy",
      blocks: [
        {
          type: 'p',
          text: 'The Platform is intended for use by individuals and organizations that possess the legal capacity to enter into binding agreements under the laws applicable within their jurisdiction. By accessing or using the Platform, users represent and warrant that they satisfy the legal age requirements established by applicable law and possess the legal authority necessary to provide Personal Information and utilize the services offered through the Platform.',
        },
        {
          type: 'p',
          text: "Fazl APP does not knowingly collect Personal Information directly from children where such collection is prohibited by applicable law. If the minimum age for independent use of digital services differs according to the jurisdiction in which a user resides, the applicable legal age established under that jurisdiction shall govern the user's eligibility to create an account or independently use the Platform.",
        },
        {
          type: 'p',
          text: "Where a child is permitted to use certain Platform features only with the authorization, supervision, or consent of a parent or legal guardian under applicable law, the parent or guardian assumes responsibility for supervising the child's use of the Platform, reviewing the information submitted, ensuring compliance with this Privacy Policy, and exercising any applicable privacy rights on behalf of the child where legally permitted.",
        },
        {
          type: 'p',
          text: 'If Fazl APP becomes aware that Personal Information has been collected from a child in violation of applicable law or without any legally required parental authorization, the Company may take appropriate action to investigate the matter. Such action may include requesting additional age verification, obtaining parental consent where legally permissible, restricting access to certain Platform features, deleting the relevant Personal Information, suspending or terminating the associated account, or implementing any other measures reasonably necessary to comply with applicable legal obligations.',
        },
        {
          type: 'p',
          text: 'Parents and legal guardians who believe that a child has provided Personal Information to Fazl APP without appropriate authorization are encouraged to contact the Company using the official communication channels described in this Privacy Policy. Upon receiving a legitimate request and after taking reasonable steps to verify the identity and authority of the requesting individual, Fazl APP will investigate the matter and take appropriate action consistent with applicable privacy legislation.',
        },
        {
          type: 'p',
          text: 'Businesses using the Platform shall not knowingly collect, request, process, disclose, or otherwise misuse Personal Information relating to children in a manner that violates applicable privacy, consumer protection, education, employment, or child protection laws. Businesses remain independently responsible for ensuring that their own products, services, advertisements, communications, promotions, and commercial activities comply with all legal requirements relating to minors.',
        },
        {
          type: 'p',
          text: 'Nothing contained within this Section shall prevent Fazl APP from collecting, retaining, or disclosing limited information where such processing is required to comply with applicable law, protect the safety of a child or another individual, investigate suspected unlawful activity, respond to lawful requests from competent authorities, establish or defend legal claims, or fulfill any other legal obligation imposed upon the Company.',
        },
        {
          type: 'p',
          text: 'Where future Platform services are specifically designed for educational institutions, youth organizations, family services, or other activities involving minors, Fazl APP may publish supplementary privacy notices, parental consent mechanisms, or additional child protection measures applicable to those particular services.',
        },
        {
          type: 'p',
          text: "The protection of children's privacy is an important component of Fazl APP's commitment to responsible data handling. The Company will continue to evaluate its policies, technologies, verification procedures, and operational practices to ensure that Personal Information relating to children receives appropriate protection consistent with evolving legal standards and industry best practices.",
        },
      ],
    },
  ],
};
