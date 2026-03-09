import { describe, expect, it } from 'vitest';

import {
  getOpsxProposeSkillTemplate,
  getOpsxProposeCommandTemplate,
} from '../../../src/core/templates/skill-templates.js';
import { generateSkillContent } from '../../../src/core/shared/skill-generation.js';

describe('opsx-propose template schema awareness', () => {
  describe('getOpsxProposeSkillTemplate', () => {
    it('defaults to spec-driven behavior when no schema provided', () => {
      const template = getOpsxProposeSkillTemplate();
      
      expect(template.name).toBe('openspec-propose');
      expect(template.instructions).toContain('tasks.md');
      expect(template.instructions).toContain('implementation steps');
      expect(template.instructions).toContain('/opsx:apply');
      expect(template.instructions).toContain('["tasks"]');
      expect(template.instructions).not.toContain('prd.json');
      expect(template.instructions).not.toContain('openspec ralph');
    });

    it('uses spec-driven behavior for spec-driven schema', () => {
      const template = getOpsxProposeSkillTemplate('spec-driven');
      
      expect(template.name).toBe('openspec-propose');
      expect(template.instructions).toContain('tasks.md');
      expect(template.instructions).toContain('implementation steps');
      expect(template.instructions).toContain('/opsx:apply');
      expect(template.instructions).toContain('["tasks"]');
      expect(template.instructions).not.toContain('prd.json');
      expect(template.instructions).not.toContain('openspec ralph');
    });

    it('uses ralph-driven behavior for ralph-driven schema', () => {
      const template = getOpsxProposeSkillTemplate('ralph-driven');
      
      expect(template.name).toBe('openspec-propose');
      expect(template.instructions).toContain('prd.json');
      expect(template.instructions).toContain('structured task definitions');
      expect(template.instructions).toContain('openspec ralph --change <name>');
      expect(template.instructions).toContain('["prd"]');
      expect(template.instructions).not.toContain('tasks.md');
      expect(template.instructions).not.toContain('/opsx:apply');
    });

    it('includes correct next command in description for spec-driven', () => {
      const template = getOpsxProposeSkillTemplate('spec-driven');
      
      expect(template.description).toContain('tasks');
      expect(template.description).not.toContain('prd.json');
    });

    it('includes correct next command in description for ralph-driven', () => {
      const template = getOpsxProposeSkillTemplate('ralph-driven');
      
      expect(template.description).toContain('prd.json');
      expect(template.description).not.toContain('tasks');
    });
  });

  describe('getOpsxProposeCommandTemplate', () => {
    it('defaults to spec-driven behavior when no schema provided', () => {
      const template = getOpsxProposeCommandTemplate();
      
      expect(template.name).toBe('OPSX: Propose');
      expect(template.content).toContain('tasks.md');
      expect(template.content).toContain('implementation steps');
      expect(template.content).toContain('/opsx:apply');
      expect(template.content).toContain('["tasks"]');
      expect(template.content).not.toContain('prd.json');
      expect(template.content).not.toContain('openspec ralph');
    });

    it('uses spec-driven behavior for spec-driven schema', () => {
      const template = getOpsxProposeCommandTemplate('spec-driven');
      
      expect(template.name).toBe('OPSX: Propose');
      expect(template.content).toContain('tasks.md');
      expect(template.content).toContain('implementation steps');
      expect(template.content).toContain('/opsx:apply');
      expect(template.content).toContain('["tasks"]');
      expect(template.content).not.toContain('prd.json');
      expect(template.content).not.toContain('openspec ralph');
    });

    it('uses ralph-driven behavior for ralph-driven schema', () => {
      const template = getOpsxProposeCommandTemplate('ralph-driven');
      
      expect(template.name).toBe('OPSX: Propose');
      expect(template.content).toContain('prd.json');
      expect(template.content).toContain('structured task definitions');
      expect(template.content).toContain('openspec ralph --change <name>');
      expect(template.content).toContain('["prd"]');
      expect(template.content).not.toContain('tasks.md');
      expect(template.content).not.toContain('/opsx:apply');
    });
  });

  describe('generated skill content', () => {
    it('generates spec-driven skill content with correct artifacts', () => {
      const template = getOpsxProposeSkillTemplate('spec-driven');
      const content = generateSkillContent(template, '1.2.0');
      
      expect(content).toContain('name: openspec-propose');
      expect(content).toContain('tasks.md');
      expect(content).toContain('/opsx:apply');
      expect(content).toContain('["tasks"]');
      expect(content).not.toContain('prd.json');
    });

    it('generates ralph-driven skill content with correct artifacts', () => {
      const template = getOpsxProposeSkillTemplate('ralph-driven');
      const content = generateSkillContent(template, '1.2.0');
      
      expect(content).toContain('name: openspec-propose');
      expect(content).toContain('prd.json');
      expect(content).toContain('openspec ralph --change <name>');
      expect(content).toContain('["prd"]');
      expect(content).not.toContain('tasks.md');
    });
  });

  describe('template consistency', () => {
    it('skill and command templates use same artifact for spec-driven', () => {
      const skillTemplate = getOpsxProposeSkillTemplate('spec-driven');
      const commandTemplate = getOpsxProposeCommandTemplate('spec-driven');
      
      // Both should mention tasks.md
      expect(skillTemplate.instructions).toContain('tasks.md');
      expect(commandTemplate.content).toContain('tasks.md');
      
      // Both should mention /opsx:apply
      expect(skillTemplate.instructions).toContain('/opsx:apply');
      expect(commandTemplate.content).toContain('/opsx:apply');
      
      // Both should mention ["tasks"]
      expect(skillTemplate.instructions).toContain('["tasks"]');
      expect(commandTemplate.content).toContain('["tasks"]');
    });

    it('skill and command templates use same artifact for ralph-driven', () => {
      const skillTemplate = getOpsxProposeSkillTemplate('ralph-driven');
      const commandTemplate = getOpsxProposeCommandTemplate('ralph-driven');
      
      // Both should mention prd.json
      expect(skillTemplate.instructions).toContain('prd.json');
      expect(commandTemplate.content).toContain('prd.json');
      
      // Both should mention openspec ralph
      expect(skillTemplate.instructions).toContain('openspec ralph');
      expect(commandTemplate.content).toContain('openspec ralph');
      
      // Both should mention ["prd"]
      expect(skillTemplate.instructions).toContain('["prd"]');
      expect(commandTemplate.content).toContain('["prd"]');
    });
  });
});
